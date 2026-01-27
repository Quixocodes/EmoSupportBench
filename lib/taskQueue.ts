import db from './db';
import { scoreAnswer } from './openrouter';
import { getAnswer, getDimension, createScore } from './queries';

export interface TaskQueue {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  current_task: string | null;
  error_message: string | null;
  max_concurrency: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TaskItem {
  id: number;
  queue_id: number;
  answer_id: number;
  dimension_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// 全局任务执行器
class TaskQueueExecutor {
  private static instance: TaskQueueExecutor;
  private runningQueues: Map<number, boolean> = new Map();
  private pausedQueues: Map<number, boolean> = new Map();
  private semaphores: Map<number, number> = new Map();

  private constructor() {}

  static getInstance(): TaskQueueExecutor {
    if (!TaskQueueExecutor.instance) {
      TaskQueueExecutor.instance = new TaskQueueExecutor();
    }
    return TaskQueueExecutor.instance;
  }

  // 暂停队列
  pauseQueue(queueId: number) {
    this.pausedQueues.set(queueId, true);
    db.prepare(`
      UPDATE task_queue 
      SET status = 'paused' 
      WHERE id = ?
    `).run(queueId);
  }

  // 恢复队列
  resumeQueue(queueId: number) {
    this.pausedQueues.delete(queueId);
  }

  // 检查队列是否被暂停
  isQueuePaused(queueId: number): boolean {
    return this.pausedQueues.get(queueId) || false;
  }

  async executeQueue(queueId: number) {
    if (this.runningQueues.get(queueId)) {
      throw new Error('Queue is already running');
    }

    this.runningQueues.set(queueId, true);
    this.pausedQueues.delete(queueId); // 清除暂停状态
    
    try {
      // 更新队列状态为运行中
      const queue = this.getQueue(queueId);
      if (!queue) throw new Error('Queue not found');

      db.prepare(`
        UPDATE task_queue 
        SET status = 'running', 
            started_at = CASE WHEN started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END
        WHERE id = ?
      `).run(queueId);

      const maxConcurrency = queue.max_concurrency;
      this.semaphores.set(queueId, 0);

      // 获取所有待执行的任务（包括失败的任务）
      const tasks = db.prepare(`
        SELECT * FROM task_items 
        WHERE queue_id = ? AND status IN ('pending', 'failed')
        ORDER BY id
      `).all(queueId) as TaskItem[];

      // 并发执行任务
      const executeTask = async (task: TaskItem) => {
        try {
          // 等待信号量和检查暂停状态
          while (
            (this.semaphores.get(queueId) || 0) >= maxConcurrency ||
            this.isQueuePaused(queueId)
          ) {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 如果队列被取消，退出
            const currentQueue = this.getQueue(queueId);
            if (currentQueue && currentQueue.status === 'cancelled') {
              throw new Error('Queue cancelled');
            }
          }

          // 增加信号量
          this.semaphores.set(queueId, (this.semaphores.get(queueId) || 0) + 1);

          // 更新任务状态
          db.prepare(`
            UPDATE task_items 
            SET status = 'running', error_message = NULL 
            WHERE id = ?
          `).run(task.id);

          // 获取答案和维度信息
          const answer = getAnswer(task.answer_id) as any;
          const dimension = getDimension(task.dimension_id) as any;

          // 更新当前任务信息
          db.prepare(`
            UPDATE task_queue 
            SET current_task = ? 
            WHERE id = ?
          `).run(
            `评分: ${answer.model_name} - ${dimension.name}`,
            queueId
          );

          // 执行评分（带重试）
          const scoreContent = await scoreAnswer(
            answer.question_content,
            answer.content,
            dimension.prompt
          );

          // 检查评分内容是否为空
          if (!scoreContent || scoreContent.trim() === '') {
            throw new Error('评分内容为空');
          }

          // 检查是否已存在评分
          const existingScore = db.prepare(`
            SELECT id FROM scores 
            WHERE answer_id = ? AND dimension_id = ?
          `).get(task.answer_id, task.dimension_id) as any;

          if (existingScore) {
            // 更新现有评分
            db.prepare(`
              UPDATE scores 
              SET score = ?, created_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `).run(scoreContent, existingScore.id);
          } else {
            // 创建新评分
            createScore(task.answer_id, task.dimension_id, scoreContent);
          }

          // 更新任务状态为完成
          db.prepare(`
            UPDATE task_items 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(task.id);

          // 更新队列完成数
          db.prepare(`
            UPDATE task_queue 
            SET completed_tasks = completed_tasks + 1,
                failed_tasks = CASE WHEN failed_tasks > 0 THEN failed_tasks - 1 ELSE 0 END
            WHERE id = ?
          `).run(queueId);

        } catch (error: any) {
          console.error(`Task ${task.id} failed:`, error);
          
          // 更新任务状态为失败
          db.prepare(`
            UPDATE task_items 
            SET status = 'failed', error_message = ? 
            WHERE id = ?
          `).run(error.message, task.id);

          // 获取之前的状态
          const prevTask = db.prepare('SELECT status FROM task_items WHERE id = ?').get(task.id) as any;
          
          // 如果之前不是失败状态，更新队列失败数
          if (prevTask && prevTask.status !== 'failed') {
            db.prepare(`
              UPDATE task_queue 
              SET failed_tasks = failed_tasks + 1 
              WHERE id = ?
            `).run(queueId);
          }

        } finally {
          // 释放信号量
          this.semaphores.set(queueId, (this.semaphores.get(queueId) || 0) - 1);
        }
      };

      // 并发执行所有任务
      await Promise.all(tasks.map(task => executeTask(task)));

      // 检查最终状态
      const finalQueue = this.getQueue(queueId);
      if (finalQueue) {
        if (this.isQueuePaused(queueId)) {
          // 队列被暂停
          db.prepare(`
            UPDATE task_queue 
            SET status = 'paused',
                current_task = NULL
            WHERE id = ?
          `).run(queueId);
        } else if (finalQueue.status === 'cancelled') {
          // 队列被取消，不做任何更新
        } else {
          // 队列正常完成
          db.prepare(`
            UPDATE task_queue 
            SET status = 'completed', 
                completed_at = CURRENT_TIMESTAMP,
                current_task = NULL
            WHERE id = ?
          `).run(queueId);
        }
      }

    } catch (error: any) {
      console.error(`Queue ${queueId} failed:`, error);
      
      // 更新队列状态为失败
      db.prepare(`
        UPDATE task_queue 
        SET status = 'failed', 
            error_message = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(error.message, queueId);

    } finally {
      this.runningQueues.delete(queueId);
      this.semaphores.delete(queueId);
    }
  }

  getQueue(queueId: number): TaskQueue | null {
    return db.prepare('SELECT * FROM task_queue WHERE id = ?').get(queueId) as TaskQueue || null;
  }

  isQueueRunning(queueId: number): boolean {
    return this.runningQueues.get(queueId) || false;
  }
}

export const taskQueueExecutor = TaskQueueExecutor.getInstance();

// 创建新的任务队列（增量式）
export function createTaskQueue(maxConcurrency: number = 3, modelIds: number[] = []): number {
  const result = db.prepare(`
    INSERT INTO task_queue (status, max_concurrency) 
    VALUES ('pending', ?)
  `).run(maxConcurrency);

  return result.lastInsertRowid as number;
}

// 添加任务项（检查是否已存在评分或评分为空）
export function addTaskItem(
  queueId: number, 
  answerId: number, 
  dimensionId: number, 
  overwriteMode: boolean = false
): boolean {
  // 检查是否已经存在该答案和维度的评分
  const existingScore = db.prepare(`
    SELECT id, score FROM scores 
    WHERE answer_id = ? AND dimension_id = ?
  `).get(answerId, dimensionId) as any;

  if (overwriteMode) {
    // 覆盖模式：删除现有评分（无论是否为空）
    if (existingScore) {
      db.prepare('DELETE FROM scores WHERE id = ?').run(existingScore.id);
    }
  } else {
    // 增量模式：如果评分存在且不为空，跳过
    if (existingScore && existingScore.score && existingScore.score.trim() !== '') {
      return false;
    }

    // 如果评分为空，删除旧的空评分记录
    if (existingScore) {
      db.prepare('DELETE FROM scores WHERE id = ?').run(existingScore.id);
    }
  }

  // 检查是否已经在其他队列中
  const existingTask = db.prepare(`
    SELECT id FROM task_items 
    WHERE answer_id = ? AND dimension_id = ? AND status IN ('pending', 'running')
  `).get(answerId, dimensionId);

  if (existingTask) {
    return false;
  }

  // 添加新任务
  db.prepare(`
    INSERT INTO task_items (queue_id, answer_id, dimension_id, status) 
    VALUES (?, ?, ?, 'pending')
  `).run(queueId, answerId, dimensionId);

  return true;
}

// 更新队列的总任务数
export function updateQueueTotalTasks(queueId: number) {
  db.prepare(`
    UPDATE task_queue 
    SET total_tasks = (
      SELECT COUNT(*) FROM task_items WHERE queue_id = ?
    )
    WHERE id = ?
  `).run(queueId, queueId);
}

// 更新队列并发数
export function updateQueueConcurrency(queueId: number, maxConcurrency: number) {
  db.prepare(`
    UPDATE task_queue 
    SET max_concurrency = ? 
    WHERE id = ?
  `).run(maxConcurrency, queueId);
}

// 获取队列信息
export function getQueue(queueId: number): TaskQueue | null {
  return db.prepare('SELECT * FROM task_queue WHERE id = ?').get(queueId) as TaskQueue || null;
}

// 获取所有队列
export function getAllQueues(): TaskQueue[] {
  return db.prepare('SELECT * FROM task_queue ORDER BY created_at DESC').all() as TaskQueue[];
}

// 获取队列的任务项
export function getQueueTasks(queueId: number): any[] {
  return db.prepare(`
    SELECT ti.*, 
           a.content as answer_content,
           m.name as model_name,
           q.content as question_content,
           d.name as dimension_name
    FROM task_items ti
    JOIN answers a ON ti.answer_id = a.id
    JOIN models m ON a.model_id = m.id
    JOIN questions q ON a.question_id = q.id
    JOIN dimensions d ON ti.dimension_id = d.id
    WHERE ti.queue_id = ?
    ORDER BY ti.id
  `).all(queueId);
}

// 获取队列的任务项（分页）
export function getQueueTasksPaginated(queueId: number, page: number = 1, limit: number = 50): any[] {
  const offset = (page - 1) * limit;
  return db.prepare(`
    SELECT ti.*, 
           a.content as answer_content,
           m.name as model_name,
           q.content as question_content,
           d.name as dimension_name
    FROM task_items ti
    JOIN answers a ON ti.answer_id = a.id
    JOIN models m ON a.model_id = m.id
    JOIN questions q ON a.question_id = q.id
    JOIN dimensions d ON ti.dimension_id = d.id
    WHERE ti.queue_id = ?
    ORDER BY ti.id
    LIMIT ? OFFSET ?
  `).all(queueId, limit, offset);
}

// 取消队列
export function cancelQueue(queueId: number) {
  db.prepare(`
    UPDATE task_queue 
    SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(queueId);
}

// 暂停队列
export function pauseQueue(queueId: number) {
  taskQueueExecutor.pauseQueue(queueId);
}

// 恢复队列
export function resumeQueue(queueId: number) {
  const queue = getQueue(queueId);
  if (!queue) return;

  // 更新状态为运行中
  db.prepare(`
    UPDATE task_queue 
    SET status = 'running' 
    WHERE id = ?
  `).run(queueId);

  // 恢复执行
  taskQueueExecutor.resumeQueue(queueId);
}

// 重试失败的任务
export function retryFailedTasks(queueId: number) {
  // 重置失败任务为待处理
  db.prepare(`
    UPDATE task_items 
    SET status = 'pending', error_message = NULL 
    WHERE queue_id = ? AND status = 'failed'
  `).run(queueId);

  // 重置队列状态
  db.prepare(`
    UPDATE task_queue 
    SET status = 'pending', 
        error_message = NULL 
    WHERE id = ?
  `).run(queueId);
}

// 删除队列
export function deleteQueue(queueId: number) {
  db.prepare('DELETE FROM task_queue WHERE id = ?').run(queueId);
}

// 获取队列统计信息
export function getQueueStats(queueId: number) {
  return db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM task_items
    WHERE queue_id = ?
  `).get(queueId);
}

// 清理所有空评分
export function cleanEmptyScores(): number {
  const result = db.prepare(`
    DELETE FROM scores 
    WHERE score IS NULL OR TRIM(score) = ''
  `).run();

  return result.changes;
}

// 获取空评分数量
export function getEmptyScoresCount(): number {
  const result = db.prepare(`
    SELECT COUNT(*) as count 
    FROM scores 
    WHERE score IS NULL OR TRIM(score) = ''
  `).get() as { count: number };

  return result.count;
}

// 获取所有空评分的答案和维度
export function getEmptyScores(): any[] {
  return db.prepare(`
    SELECT s.*, 
           a.content as answer_content,
           m.name as model_name,
           q.content as question_content,
           d.name as dimension_name
    FROM scores s
    JOIN answers a ON s.answer_id = a.id
    JOIN models m ON a.model_id = m.id
    JOIN questions q ON a.question_id = q.id
    JOIN dimensions d ON s.dimension_id = d.id
    WHERE s.score IS NULL OR TRIM(s.score) = ''
    ORDER BY s.id
  `).all();
}

// ==================== 批量推理功能 ====================

export interface InferenceTaskItem {
  id: number;
  queue_id: number;
  question_id: number;
  model_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// 创建推理任务队列
export function createInferenceQueue(maxConcurrency: number = 3): number {
  const result = db.prepare(`
    INSERT INTO inference_queue (status, max_concurrency) 
    VALUES ('pending', ?)
  `).run(maxConcurrency);

  return result.lastInsertRowid as number;
}

// 添加推理任务项
export function addInferenceTask(queueId: number, questionId: number, modelId: number): boolean {
  // 检查是否已经存在该问题和模型的答案
  const existingAnswer = db.prepare(`
    SELECT id FROM answers 
    WHERE question_id = ? AND model_id = ?
  `).get(questionId, modelId);

  // 如果已存在答案，跳过
  if (existingAnswer) {
    return false;
  }

  // 检查是否已经在其他队列中
  const existingTask = db.prepare(`
    SELECT id FROM inference_tasks 
    WHERE question_id = ? AND model_id = ? AND status IN ('pending', 'running')
  `).get(questionId, modelId);

  if (existingTask) {
    return false;
  }

  // 添加新任务
  db.prepare(`
    INSERT INTO inference_tasks (queue_id, question_id, model_id, status) 
    VALUES (?, ?, ?, 'pending')
  `).run(queueId, questionId, modelId);

  return true;
}

// 更新推理队列的总任务数
export function updateInferenceQueueTotalTasks(queueId: number) {
  db.prepare(`
    UPDATE inference_queue 
    SET total_tasks = (
      SELECT COUNT(*) FROM inference_tasks WHERE queue_id = ?
    )
    WHERE id = ?
  `).run(queueId, queueId);
}

// 获取推理队列信息
export function getInferenceQueue(queueId: number): any {
  return db.prepare('SELECT * FROM inference_queue WHERE id = ?').get(queueId);
}

// 获取所有推理队列
export function getAllInferenceQueues(): any[] {
  return db.prepare('SELECT * FROM inference_queue ORDER BY created_at DESC').all();
}

// 获取推理队列的任务项
export function getInferenceQueueTasks(queueId: number): any[] {
  return db.prepare(`
    SELECT it.*, 
           q.content as question_content,
           m.name as model_name
    FROM inference_tasks it
    JOIN questions q ON it.question_id = q.id
    JOIN models m ON it.model_id = m.id
    WHERE it.queue_id = ?
    ORDER BY it.id
  `).all(queueId);
}

// 执行推理队列
class InferenceQueueExecutor {
  private static instance: InferenceQueueExecutor;
  private runningQueues: Map<number, boolean> = new Map();
  private pausedQueues: Map<number, boolean> = new Map();
  private semaphores: Map<number, number> = new Map();

  private constructor() {}

  static getInstance(): InferenceQueueExecutor {
    if (!InferenceQueueExecutor.instance) {
      InferenceQueueExecutor.instance = new InferenceQueueExecutor();
    }
    return InferenceQueueExecutor.instance;
  }

  pauseQueue(queueId: number) {
    this.pausedQueues.set(queueId, true);
    db.prepare(`
      UPDATE inference_queue 
      SET status = 'paused' 
      WHERE id = ?
    `).run(queueId);
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

  async executeQueue(queueId: number) {
    if (this.runningQueues.get(queueId)) {
      throw new Error('Queue is already running');
    }

    this.runningQueues.set(queueId, true);
    this.pausedQueues.delete(queueId);
    
    try {
      const queue = this.getQueue(queueId);
      if (!queue) throw new Error('Queue not found');

      db.prepare(`
        UPDATE inference_queue 
        SET status = 'running', 
            started_at = CASE WHEN started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END
        WHERE id = ?
      `).run(queueId);

      const maxConcurrency = queue.max_concurrency;
      this.semaphores.set(queueId, 0);

      const tasks = db.prepare(`
        SELECT * FROM inference_tasks 
        WHERE queue_id = ? AND status IN ('pending', 'failed')
        ORDER BY id
      `).all(queueId) as InferenceTaskItem[];

      const executeTask = async (task: InferenceTaskItem) => {
        try {
          while (
            (this.semaphores.get(queueId) || 0) >= maxConcurrency ||
            this.isQueuePaused(queueId)
          ) {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const currentQueue = this.getQueue(queueId);
            if (currentQueue && currentQueue.status === 'cancelled') {
              throw new Error('Queue cancelled');
            }
          }

          this.semaphores.set(queueId, (this.semaphores.get(queueId) || 0) + 1);

          db.prepare(`
            UPDATE inference_tasks 
            SET status = 'running', error_message = NULL 
            WHERE id = ?
          `).run(task.id);

          // 获取问题和模型信息
          const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(task.question_id) as any;
          const model = db.prepare('SELECT * FROM models WHERE id = ?').get(task.model_id) as any;

          db.prepare(`
            UPDATE inference_queue 
            SET current_task = ? 
            WHERE id = ?
          `).run(
            `推理: ${model.name} - 问题 #${question.id}`,
            queueId
          );

          // 调用 OpenRouter API 获取答案
          const { getModelAnswer } = await import('./openrouter');
          const answerContent = await getModelAnswer(model.name, question.content);

          // 保存答案
          const result = db.prepare(`
            INSERT INTO answers (question_id, model_id, content) 
            VALUES (?, ?, ?)
          `).run(task.question_id, task.model_id, answerContent);

          db.prepare(`
            UPDATE inference_tasks 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(task.id);

          db.prepare(`
            UPDATE inference_queue 
            SET completed_tasks = completed_tasks + 1,
                failed_tasks = CASE WHEN failed_tasks > 0 THEN failed_tasks - 1 ELSE 0 END
            WHERE id = ?
          `).run(queueId);

        } catch (error: any) {
          console.error(`Inference task ${task.id} failed:`, error);
          
          db.prepare(`
            UPDATE inference_tasks 
            SET status = 'failed', error_message = ? 
            WHERE id = ?
          `).run(error.message, task.id);

          const prevTask = db.prepare('SELECT status FROM inference_tasks WHERE id = ?').get(task.id) as any;
          
          if (prevTask && prevTask.status !== 'failed') {
            db.prepare(`
              UPDATE inference_queue 
              SET failed_tasks = failed_tasks + 1 
              WHERE id = ?
            `).run(queueId);
          }

        } finally {
          this.semaphores.set(queueId, (this.semaphores.get(queueId) || 0) - 1);
        }
      };

      await Promise.all(tasks.map(task => executeTask(task)));

      const finalQueue = this.getQueue(queueId);
      if (finalQueue) {
        if (this.isQueuePaused(queueId)) {
          db.prepare(`
            UPDATE inference_queue 
            SET status = 'paused',
                current_task = NULL
            WHERE id = ?
          `).run(queueId);
        } else if (finalQueue.status === 'cancelled') {
          // 队列被取消，不做任何更新
        } else {
          db.prepare(`
            UPDATE inference_queue 
            SET status = 'completed', 
                completed_at = CURRENT_TIMESTAMP,
                current_task = NULL
            WHERE id = ?
          `).run(queueId);
        }
      }

    } catch (error: any) {
      console.error(`Inference queue ${queueId} failed:`, error);
      
      db.prepare(`
        UPDATE inference_queue 
        SET status = 'failed', 
            error_message = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(error.message, queueId);

    } finally {
      this.runningQueues.delete(queueId);
      this.semaphores.delete(queueId);
    }
  }

  getQueue(queueId: number): any {
    return db.prepare('SELECT * FROM inference_queue WHERE id = ?').get(queueId);
  }
}

export const inferenceQueueExecutor = InferenceQueueExecutor.getInstance();

// 取消推理队列
export function cancelInferenceQueue(queueId: number) {
  db.prepare(`
    UPDATE inference_queue 
    SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(queueId);
}

// 暂停推理队列
export function pauseInferenceQueue(queueId: number) {
  inferenceQueueExecutor.pauseQueue(queueId);
}

// 恢复推理队列
export function resumeInferenceQueue(queueId: number) {
  const queue = getInferenceQueue(queueId);
  if (!queue) return;

  db.prepare(`
    UPDATE inference_queue 
    SET status = 'running' 
    WHERE id = ?
  `).run(queueId);

  inferenceQueueExecutor.resumeQueue(queueId);
}

// 重试失败的推理任务
export function retryFailedInferenceTasks(queueId: number) {
  db.prepare(`
    UPDATE inference_tasks 
    SET status = 'pending', error_message = NULL 
    WHERE queue_id = ? AND status = 'failed'
  `).run(queueId);

  db.prepare(`
    UPDATE inference_queue 
    SET status = 'pending', 
        error_message = NULL 
    WHERE id = ?
  `).run(queueId);
}

// 删除推理队列
export function deleteInferenceQueue(queueId: number) {
  db.prepare('DELETE FROM inference_queue WHERE id = ?').run(queueId);
}

// 更新推理队列并发数
export function updateInferenceQueueConcurrency(queueId: number, maxConcurrency: number) {
  db.prepare(`
    UPDATE inference_queue 
    SET max_concurrency = ? 
    WHERE id = ?
  `).run(maxConcurrency, queueId);
}
