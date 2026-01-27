// lib/arenaBatchQueue.ts
import db from './db';
import { callOpenRouter } from './openrouter';
import { getDimensions } from './queries';

// 最大重试次数（针对空响应）
const MAX_EMPTY_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒

interface ArenaBatchQueue {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  current_task: string | null;
  error_message: string | null;
  max_concurrency: number;
  max_rounds: number;
  expert_a_id: number;
  expert_b_id: number;
  expert_c_id: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface ArenaBatchTask {
  id: number;
  queue_id: number;
  question_id: number;
  answer_id: number;
  session_id: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_round: number;
  is_agreed: number;
  needs_judgment: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 提取分数
function extractScore(text: string): number | null {
  const xmlMatches = text?.match(/<score>(.*?)<\/score>/g);
  if (xmlMatches && xmlMatches.length > 0) {
    const lastMatch = xmlMatches[xmlMatches.length - 1];
    const numberMatch = lastMatch.match(/<score>(.*?)<\/score>/);
    if (numberMatch && numberMatch[1]) {
      const score = parseFloat(numberMatch[1]);
      if (!isNaN(score)) return score;
    }
  }
  return null;
}

// 构建历史评价块
function buildHistoryBlock(
  scores: any[],
  expertType: 'A' | 'B',
  dimensionId: number,
  roundNumber: number
): string {
  const myScores = scores.filter(
    s => s.expert_type === expertType && s.dimension_id === dimensionId
  ).sort((a, b) => a.round_number - b.round_number);

  const otherType = expertType === 'A' ? 'B' : 'A';
  const otherScores = scores.filter(
    s => s.expert_type === otherType && s.dimension_id === dimensionId
  ).sort((a, b) => a.round_number - b.round_number);

  let history = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  history += `【历史评价参考 - 第${roundNumber}轮交锋】\n`;
  history += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  if (myScores.length > 0) {
    history += `\n你在之前轮次的评价：\n`;
    myScores.forEach((s, index) => {
      history += `\n【第${s.round_number}轮】\n${s.score_text}\n`;
      if (index < myScores.length - 1) history += `${'─'.repeat(40)}\n`;
    });
  }

  if (otherScores.length > 0) {
    history += `\n\n另一位专家在之前轮次的评价：\n`;
    otherScores.forEach((s, index) => {
      history += `\n【第${s.round_number}轮】\n${s.score_text}\n`;
      if (index < otherScores.length - 1) history += `${'─'.repeat(40)}\n`;
    });
  }

  history += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  history += '\n本轮评分要求：\n';
  history += '1. 仔细阅读上述历史评价，理解双方的观点和分歧点\n';
  history += '2. 在你的评价中明确说明你的观点调整和理由\n';
  history += '3. 给出你本轮的评分，并说明评分的理由\n';
  history += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  return history;
}

// 批量竞技场执行器
class ArenaBatchExecutor {
  private static instance: ArenaBatchExecutor;
  private runningQueues: Map<number, boolean> = new Map();
  private pausedQueues: Map<number, boolean> = new Map();
  private semaphores: Map<number, number> = new Map();

  private constructor() {}

  static getInstance(): ArenaBatchExecutor {
    if (!ArenaBatchExecutor.instance) {
      ArenaBatchExecutor.instance = new ArenaBatchExecutor();
    }
    return ArenaBatchExecutor.instance;
  }

  pauseQueue(queueId: number) {
    this.pausedQueues.set(queueId, true);
    db.prepare('UPDATE arena_batch_queue SET status = ? WHERE id = ?')
      .run('paused', queueId);
  }

  resumeQueue(queueId: number) {
    this.pausedQueues.delete(queueId);
  }

  isQueuePaused(queueId: number): boolean {
    return this.pausedQueues.get(queueId) || false;
  }

  isQueueRunning(queueId: number): boolean {
    return this.runningQueues.get(queueId) || false;
  }

  // 执行单个维度的评分（带重试确保非空）
  private async scoreWithRetry(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    retryCount: number = 0
  ): Promise<string> {
    const scoreText = await callOpenRouter(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    // 检查是否为空
    if (!scoreText || scoreText.trim().length === 0) {
      if (retryCount < MAX_EMPTY_RETRIES) {
        console.log(`Empty response, retrying (${retryCount + 1}/${MAX_EMPTY_RETRIES})...`);
        await delay(RETRY_DELAY);
        return this.scoreWithRetry(model, systemPrompt, userPrompt, retryCount + 1);
      }
      throw new Error('返回内容为空，已达最大重试次数');
    }

    return scoreText;
  }

  // 执行单轮对战
  private async executeBattle(
    sessionId: number,
    roundNumber: number,
    queue: any,
    question: string,
    answer: string
  ): Promise<boolean> {
    const dimensions = getDimensions() as any[];
    const historicalScores = db.prepare(`
      SELECT * FROM arena_scores
      WHERE session_id = ? AND round_number < ?
    `).all(sessionId, roundNumber) as any[];

    // 确定需要评分的维度
    let dimensionsToScore = dimensions;
    if (roundNumber > 1) {
      const lastRoundScores = db.prepare(`
        SELECT dimension_id FROM arena_scores
        WHERE session_id = ? AND round_number = ? AND is_agreed = 0
        GROUP BY dimension_id
      `).all(sessionId, roundNumber - 1) as any[];

      const disagreedDimensionIds = lastRoundScores.map(s => s.dimension_id);
      dimensionsToScore = dimensions.filter(d => disagreedDimensionIds.includes(d.id));
    }

    // 如果没有需要评分的维度，返回 true（全部达成一致）
    if (dimensionsToScore.length === 0) {
      return true;
    }

    // 并行评分
    const scoringTasks = [];

    for (const dimension of dimensionsToScore) {
      // A专家评分
      const taskA = (async () => {
        let prompt = `【评分任务 - 第${roundNumber}轮】\n\n`;
        prompt += `问题：\n${question}\n\n`;
        prompt += `回答：\n${answer}\n\n`;
        prompt += `评分维度：${dimension.name}\n`;
        prompt += `评分标准：\n${dimension.prompt}\n`;

        if (roundNumber > 1) {
          prompt += buildHistoryBlock(historicalScores, 'A', dimension.id, roundNumber);
        }

        prompt += '\n请务必在回复的最后以XML格式输出分数：<score>分数</score>';

        const scoreText = await this.scoreWithRetry(
          queue.expert_a_model,
          queue.expert_a_prompt,
          prompt
        );
        const scoreValue = extractScore(scoreText);

        return {
          expertType: 'A',
          dimensionId: dimension.id,
          scoreValue,
          scoreText
        };
      })();

      // B专家评分
      const taskB = (async () => {
        let prompt = `【评分任务 - 第${roundNumber}轮】\n\n`;
        prompt += `问题：\n${question}\n\n`;
        prompt += `回答：\n${answer}\n\n`;
        prompt += `评分维度：${dimension.name}\n`;
        prompt += `评分标准：\n${dimension.prompt}\n`;

        if (roundNumber > 1) {
          prompt += buildHistoryBlock(historicalScores, 'B', dimension.id, roundNumber);
        }

        prompt += '\n请务必在回复的最后以XML格式输出分数：<score>分数</score>';

        const scoreText = await this.scoreWithRetry(
          queue.expert_b_model,
          queue.expert_b_prompt,
          prompt
        );
        const scoreValue = extractScore(scoreText);

        return {
          expertType: 'B',
          dimensionId: dimension.id,
          scoreValue,
          scoreText
        };
      })();

      scoringTasks.push(taskA, taskB);
    }

    const results = await Promise.all(scoringTasks);

    // 保存评分
    const insertStmt = db.prepare(`
      INSERT INTO arena_scores
      (session_id, dimension_id, round_number, expert_type, score_value, score_text, is_agreed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const result of results) {
      insertStmt.run(
        sessionId,
        result.dimensionId,
        roundNumber,
        result.expertType,
        result.scoreValue,
        result.scoreText,
        0
      );
    }

    // 检查一致性
    let allAgreed = true;
    for (const dimension of dimensionsToScore) {
      const scoresForDimension = results.filter(r => r.dimensionId === dimension.id);
      const scoreA = scoresForDimension.find(r => r.expertType === 'A');
      const scoreB = scoresForDimension.find(r => r.expertType === 'B');

      if (scoreA && scoreB &&
          scoreA.scoreValue !== null && scoreB.scoreValue !== null &&
          scoreA.scoreValue === scoreB.scoreValue) {
        db.prepare(`
          UPDATE arena_scores
          SET is_agreed = 1
          WHERE session_id = ? AND dimension_id = ? AND round_number = ?
        `).run(sessionId, dimension.id, roundNumber);
      } else {
        allAgreed = false;
      }
    }

    return allAgreed;
  }

  // 执行裁决
  private async executeJudgment(sessionId: number, queue: any, question: string, answer: string) {
    const disagreedDimensions = db.prepare(`
      SELECT DISTINCT dimension_id
      FROM arena_scores
      WHERE session_id = ? AND is_agreed = 0
    `).all(sessionId) as any[];

    if (disagreedDimensions.length === 0) return;

    const allScores = db.prepare(`
      SELECT * FROM arena_scores
      WHERE session_id = ?
      ORDER BY dimension_id, round_number, expert_type
    `).all(sessionId) as any[];

    const dimensions = db.prepare(`
      SELECT * FROM dimensions
      WHERE id IN (${disagreedDimensions.map(() => '?').join(',')})
    `).all(...disagreedDimensions.map(d => d.dimension_id)) as any[];

    for (const dimension of dimensions) {
      const scoresForDimension = allScores.filter(s => s.dimension_id === dimension.id);

      let prompt = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      prompt += '【裁判任务 - 最终裁决】\n';
      prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      prompt += `评分维度：${dimension.name}\n\n`;
      prompt += `评分标准：\n${dimension.prompt}\n\n`;
      prompt += `原始问题：\n${question}\n\n`;
      prompt += `待评分回答：\n${answer}\n\n`;
      prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      prompt += '【双方专家的完整交锋记录】\n';
      prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      const maxRound = Math.max(...scoresForDimension.map(s => s.round_number));
      for (let round = 1; round <= maxRound; round++) {
        const roundScores = scoresForDimension.filter(s => s.round_number === round);
        const scoreA = roundScores.find(s => s.expert_type === 'A');
        const scoreB = roundScores.find(s => s.expert_type === 'B');

        prompt += `\n【第${round}轮交锋】\n`;
        if (scoreA) {
          prompt += `专家A: ${scoreA.score_value !== null ? scoreA.score_value : '未识别'}\n`;
          prompt += `${scoreA.score_text}\n\n`;
        }
        if (scoreB) {
          prompt += `专家B: ${scoreB.score_value !== null ? scoreB.score_value : '未识别'}\n`;
          prompt += `${scoreB.score_text}\n\n`;
        }
      }

      prompt += '\n请务必在回复的最后以XML格式输出分数：<score>分数</score>';

      const judgmentText = await this.scoreWithRetry(
        queue.expert_c_model,
        queue.expert_c_prompt,
        prompt
      );
      const finalScore = extractScore(judgmentText);

      db.prepare(`
        INSERT OR REPLACE INTO arena_judgments
        (session_id, dimension_id, final_score, judgment_text)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, dimension.id, finalScore, judgmentText);
    }
  }

  // 执行单个任务
  private async executeTask(task: ArenaBatchTask, queue: any) {
    // 获取问题和回答
    const question = db.prepare('SELECT content FROM questions WHERE id = ?')
      .get(task.question_id) as any;
    const answer = db.prepare('SELECT content FROM answers WHERE id = ?')
      .get(task.answer_id) as any;

    // 创建或获取会话
    let sessionId = task.session_id;
    if (!sessionId) {
      const result = db.prepare(`
        INSERT INTO arena_sessions
        (question, answer, max_rounds, expert_a_id, expert_b_id, expert_c_id, status, current_round)
        VALUES (?, ?, ?, ?, ?, ?, 'in_progress', 0)
      `).run(
        question.content,
        answer.content,
        queue.max_rounds,
        queue.expert_a_id,
        queue.expert_b_id,
        queue.expert_c_id
      );

      sessionId = result.lastInsertRowid as number;

      db.prepare('UPDATE arena_batch_tasks SET session_id = ? WHERE id = ?')
        .run(sessionId, task.id);
    }

    // 执行多轮对战（串行）
    let allAgreed = false;
    let currentRound = task.current_round;

    while (currentRound < queue.max_rounds && !allAgreed) {
      currentRound++;

      // 更新任务当前轮次
      db.prepare('UPDATE arena_batch_tasks SET current_round = ? WHERE id = ?')
        .run(currentRound, task.id);

      // 执行本轮对战
      allAgreed = await this.executeBattle(
        sessionId,
        currentRound,
        queue,
        question.content,
        answer.content
      );

      // 更新会话轮次
      db.prepare('UPDATE arena_sessions SET current_round = ? WHERE id = ?')
        .run(currentRound, sessionId);
    }

    // 如果未达成一致，需要裁决
    if (!allAgreed) {
      await this.executeJudgment(sessionId, queue, question.content, answer.content);
      db.prepare('UPDATE arena_batch_tasks SET needs_judgment = 1 WHERE id = ?')
        .run(task.id);
    } else {
      db.prepare('UPDATE arena_batch_tasks SET is_agreed = 1 WHERE id = ?')
        .run(task.id);
    }

    // 更新会话状态
    db.prepare(`
      UPDATE arena_sessions
      SET status = 'judged', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sessionId);
  }

  async executeQueue(queueId: number) {
    if (this.runningQueues.get(queueId)) {
      throw new Error('Queue is already running');
    }

    this.runningQueues.set(queueId, true);
    this.pausedQueues.delete(queueId);

    try {
      const queue = db.prepare(`
        SELECT q.*,
               ea.model_name as expert_a_model, ea.prompt as expert_a_prompt,
               eb.model_name as expert_b_model, eb.prompt as expert_b_prompt,
               ec.model_name as expert_c_model, ec.prompt as expert_c_prompt
        FROM arena_batch_queue q
        LEFT JOIN arena_experts ea ON q.expert_a_id = ea.id
        LEFT JOIN arena_experts eb ON q.expert_b_id = eb.id
        LEFT JOIN arena_experts ec ON q.expert_c_id = ec.id
        WHERE q.id = ?
      `).get(queueId) as any;

      if (!queue) throw new Error('Queue not found');

      db.prepare(`
        UPDATE arena_batch_queue
        SET status = 'running',
            started_at = CASE WHEN started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END
        WHERE id = ?
      `).run(queueId);

      const maxConcurrency = queue.max_concurrency;
      this.semaphores.set(queueId, 0);

      const tasks = db.prepare(`
        SELECT * FROM arena_batch_tasks
        WHERE queue_id = ? AND status IN ('pending', 'failed')
        ORDER BY id
      `).all(queueId) as ArenaBatchTask[];

      const executeTaskWrapper = async (task: ArenaBatchTask) => {
        try {
          // 等待信号量
          while (
            (this.semaphores.get(queueId) || 0) >= maxConcurrency ||
            this.isQueuePaused(queueId)
          ) {
            await delay(100);

            const currentQueue = db.prepare('SELECT status FROM arena_batch_queue WHERE id = ?')
              .get(queueId) as any;
            if (currentQueue && currentQueue.status === 'cancelled') {
              throw new Error('Queue cancelled');
            }
          }

          this.semaphores.set(queueId, (this.semaphores.get(queueId) || 0) + 1);

          db.prepare('UPDATE arena_batch_tasks SET status = ?, error_message = NULL WHERE id = ?')
            .run('running', task.id);

          const answer = db.prepare('SELECT * FROM answers WHERE id = ?').get(task.answer_id) as any;
          const model = db.prepare('SELECT * FROM models WHERE id = ?').get(answer.model_id) as any;
          const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(task.question_id) as any;

          db.prepare('UPDATE arena_batch_queue SET current_task = ? WHERE id = ?')
            .run(`竞技场: ${model.name} - ${question.content.substring(0, 50)}...`, queueId);

          await this.executeTask(task, queue);

          db.prepare('UPDATE arena_batch_tasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run('completed', task.id);

          db.prepare('UPDATE arena_batch_queue SET completed_tasks = completed_tasks + 1 WHERE id = ?')
            .run(queueId);

        } catch (error: any) {
          console.error(`Arena batch task ${task.id} failed:`, error);

          db.prepare('UPDATE arena_batch_tasks SET status = ?, error_message = ? WHERE id = ?')
            .run('failed', error.message, task.id);

          db.prepare('UPDATE arena_batch_queue SET failed_tasks = failed_tasks + 1 WHERE id = ?')
            .run(queueId);

        } finally {
          this.semaphores.set(queueId, (this.semaphores.get(queueId) || 0) - 1);
        }
      };

      await Promise.all(tasks.map(task => executeTaskWrapper(task)));

      const finalQueue = db.prepare('SELECT * FROM arena_batch_queue WHERE id = ?')
        .get(queueId) as any;

      if (finalQueue) {
        if (this.isQueuePaused(queueId)) {
          db.prepare('UPDATE arena_batch_queue SET status = ?, current_task = NULL WHERE id = ?')
            .run('paused', queueId);
        } else if (finalQueue.status === 'cancelled') {
          // 不做任何更新
        } else {
          db.prepare('UPDATE arena_batch_queue SET status = ?, completed_at = CURRENT_TIMESTAMP, current_task = NULL WHERE id = ?')
            .run('completed', queueId);
        }
      }

    } catch (error: any) {
      console.error(`Arena batch queue ${queueId} failed:`, error);

      db.prepare('UPDATE arena_batch_queue SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('failed', error.message, queueId);

    } finally {
      this.runningQueues.delete(queueId);
      this.semaphores.delete(queueId);
    }
  }
}

export const arenaBatchExecutor = ArenaBatchExecutor.getInstance();

// 导出函数
export function createArenaBatchQueue(
  maxConcurrency: number,
  maxRounds: number,
  expertAId: number,
  expertBId: number,
  expertCId: number
): number {
  const result = db.prepare(`
    INSERT INTO arena_batch_queue
    (status, max_concurrency, max_rounds, expert_a_id, expert_b_id, expert_c_id)
    VALUES ('pending', ?, ?, ?, ?, ?)
  `).run(maxConcurrency, maxRounds, expertAId, expertBId, expertCId);

  return result.lastInsertRowid as number;
}

export function addArenaBatchTask(
  queueId: number,
  questionId: number,
  answerId: number
): boolean {
  // 检查是否已存在
  const existing = db.prepare(`
    SELECT id FROM arena_batch_tasks
    WHERE queue_id = ? AND question_id = ? AND answer_id = ?
  `).get(queueId, questionId, answerId);

  if (existing) return false;

  db.prepare(`
    INSERT INTO arena_batch_tasks (queue_id, question_id, answer_id, status)
    VALUES (?, ?, ?, 'pending')
  `).run(queueId, questionId, answerId);

  return true;
}

export function updateArenaBatchQueueTotalTasks(queueId: number) {
  db.prepare(`
    UPDATE arena_batch_queue
    SET total_tasks = (SELECT COUNT(*) FROM arena_batch_tasks WHERE queue_id = ?)
    WHERE id = ?
  `).run(queueId, queueId);
}

export function getAllArenaBatchQueues(): any[] {
  return db.prepare('SELECT * FROM arena_batch_queue ORDER BY created_at DESC').all();
}

export function getArenaBatchQueue(queueId: number): any {
  return db.prepare('SELECT * FROM arena_batch_queue WHERE id = ?').get(queueId);
}

export function getArenaBatchTasks(queueId: number): any[] {
  return db.prepare(`
    SELECT abt.*,
           q.content as question_content,
           a.content as answer_content,
           m.name as model_name
    FROM arena_batch_tasks abt
    JOIN questions q ON abt.question_id = q.id
    JOIN answers a ON abt.answer_id = a.id
    JOIN models m ON a.model_id = m.id
    WHERE abt.queue_id = ?
    ORDER BY abt.id
  `).all(queueId);
}

export function pauseArenaBatchQueue(queueId: number) {
  arenaBatchExecutor.pauseQueue(queueId);
}

export function resumeArenaBatchQueue(queueId: number) {
  db.prepare('UPDATE arena_batch_queue SET status = ? WHERE id = ?')
    .run('running', queueId);
  arenaBatchExecutor.resumeQueue(queueId);
}

export function cancelArenaBatchQueue(queueId: number) {
  db.prepare('UPDATE arena_batch_queue SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('cancelled', queueId);
}

export function deleteArenaBatchQueue(queueId: number) {
  db.prepare('DELETE FROM arena_batch_queue WHERE id = ?').run(queueId);
}
