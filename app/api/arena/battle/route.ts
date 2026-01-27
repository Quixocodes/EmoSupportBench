// app/api/arena/battle/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { callOpenRouter } from '@/lib/openrouter';
import { getDimensions } from '@/lib/queries';
import { getServerTranslation } from '@/lib/i18n/server';

// Extract score from text
function extractScore(text: string): number | null {
  const xmlMatches = text.match(/<score>(.*?)<\/score>/g);
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

// Build history evaluation block
function buildHistoryBlock(
  scores: any[],
  expertType: 'A' | 'B',
  dimensionId: number,
  roundNumber: number,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
    const myScores = scores.filter(s =>
      s.expert_type === expertType && s.dimension_id === dimensionId
    ).sort((a, b) => a.round_number - b.round_number);

    const otherType = expertType === 'A' ? 'B' : 'A';
    const otherScores = scores.filter(s =>
      s.expert_type === otherType && s.dimension_id === dimensionId
    ).sort((a, b) => a.round_number - b.round_number);

    let history = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    history += t('prompt.historyTitle', { round: roundNumber }) + '\n';
    history += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    if (myScores.length > 0) {
      history += `\n📋 ${t('prompt.historyMyScores')}\n`;
      myScores.forEach((s, index) => {
        history += `\n${t('prompt.historyRound', { round: s.round_number })}\n`;
        history += `${s.score_text}\n`;
        if (index < myScores.length - 1) {
          history += `${'─'.repeat(40)}\n`;
        }
      });
    }

    if (otherScores.length > 0) {
      history += `\n\n🔄 ${t('prompt.historyOtherScores')}\n`;
      otherScores.forEach((s, index) => {
        history += `\n${t('prompt.historyRound', { round: s.round_number })}\n`;
        history += `${s.score_text}\n`;
        if (index < otherScores.length - 1) {
          history += `${'─'.repeat(40)}\n`;
        }
      });
    }

    history += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    history += `\n💡 ${t('prompt.historyRequirements')}\n`;
    history += t('prompt.historyReq1') + '\n';
    history += t('prompt.historyReq2') + '\n';
    history += t('prompt.historyReq2a') + '\n';
    history += t('prompt.historyReq2b') + '\n';
    history += t('prompt.historyReq2c') + '\n';
    history += t('prompt.historyReq3') + '\n';
    history += t('prompt.historyReq4') + '\n';
    history += t('prompt.historyReq5') + '\n';
    history += `\n⚠️ ${t('prompt.historyNotice')}\n`;
    history += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return history;
  }

  function buildExpertPrompt(
    session: any,
    dimension: any,
    roundNumber: number,
    expertType: 'A' | 'B',
    historicalScores: any[],
    t: (key: string, params?: Record<string, string | number>) => string
  ): string {
    let prompt = t('prompt.battleRound', { round: roundNumber }) + '\n\n';
    prompt += `${t('prompt.battleQuestion')}\n${session.question}\n\n`;
    prompt += `${t('prompt.battleAnswer')}\n${session.answer}\n\n`;
    prompt += t('prompt.battleDimension', { name: dimension.name }) + '\n';
    prompt += `${t('prompt.battleCriteria')}\n${dimension.prompt}\n`;

    if (roundNumber > 1) {
      prompt += buildHistoryBlock(historicalScores, expertType, dimension.id, roundNumber, t);
      prompt += `\n\n${t('prompt.roundFormatTitle')}\n`;
      prompt += t('prompt.roundFormatIntro') + '\n\n';
      prompt += t('prompt.roundHistoryResponse') + '\n';
      prompt += t('prompt.roundMyReview') + '\n';
      prompt += t('prompt.roundOtherAnalysis') + '\n';
      prompt += t('prompt.roundAdjustment') + '\n\n';
      prompt += t('prompt.roundCurrentAnalysis') + '\n';
      prompt += t('prompt.roundNewInsight') + '\n';
      prompt += t('prompt.roundReason') + '\n';
      prompt += t('prompt.roundScore') + '\n\n';
    } else {
      prompt += `\n\n${t('prompt.firstRoundTitle')}\n`;
      prompt += t('prompt.firstRoundIntro') + '\n';
      prompt += t('prompt.firstRoundReq1') + '\n';
      prompt += t('prompt.firstRoundReq2') + '\n';
      prompt += t('prompt.firstRoundReq3') + '\n\n';
    }

    prompt += t('prompt.xmlScoreReminder') + '\n';
    prompt += t('prompt.xmlScoreExample');

    return prompt;
  }

  export async function POST(request: NextRequest) {
    try {
      const { sessionId, roundNumber, locale = 'en' } = await request.json();
      const t = getServerTranslation(locale);

      // Get session info
      const session = db.prepare(`
        SELECT s.*,
               ea.model_name as expert_a_model, ea.prompt as expert_a_prompt,
               eb.model_name as expert_b_model, eb.prompt as expert_b_prompt
        FROM arena_sessions s
        LEFT JOIN arena_experts ea ON s.expert_a_id = ea.id
        LEFT JOIN arena_experts eb ON s.expert_b_id = eb.id
        WHERE s.id = ?
      `).get(sessionId) as any;

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Get all dimensions
      const dimensions = getDimensions() as any[];

      // Get historical scores
      const historicalScores = db.prepare(`
        SELECT * FROM arena_scores
        WHERE session_id = ? AND round_number < ?
      `).all(sessionId, roundNumber) as any[];

      // Determine which dimensions to score
      let dimensionsToScore = dimensions;

      if (roundNumber > 1) {
        // Round 2+: only score dimensions with disagreement
        const lastRoundScores = db.prepare(`
          SELECT dimension_id FROM arena_scores
          WHERE session_id = ? AND round_number = ? AND is_agreed = 0
          GROUP BY dimension_id
        `).all(sessionId, roundNumber - 1) as any[];

        const disagreedDimensionIds = lastRoundScores.map(s => s.dimension_id);
        dimensionsToScore = dimensions.filter(d => disagreedDimensionIds.includes(d.id));
      }

      // Parallel scoring
      const scoringTasks = [];

      for (const dimension of dimensionsToScore) {
        // Expert A scoring
        const taskA = (async () => {
          const prompt = buildExpertPrompt(session, dimension, roundNumber, 'A', historicalScores, t);

          const scoreText = await callOpenRouter(session.expert_a_model, [
            { role: 'system', content: session.expert_a_prompt },
            { role: 'user', content: prompt }
          ]);

          const scoreValue = extractScore(scoreText);

          return {
            expertType: 'A',
            dimensionId: dimension.id,
            scoreValue,
            scoreText
          };
        })();

        // Expert B scoring
        const taskB = (async () => {
          const prompt = buildExpertPrompt(session, dimension, roundNumber, 'B', historicalScores, t);

          const scoreText = await callOpenRouter(session.expert_b_model, [
            { role: 'system', content: session.expert_b_prompt },
            { role: 'user', content: prompt }
          ]);

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

      // Save scores
      const insertStmt = db.prepare(`
        INSERT INTO arena_scores
        (session_id, dimension_id, round_number, expert_type, score_value, score_text, is_agreed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      // Save all scores (temporarily marked as disagreed)
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

      // Check consistency and update
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
        }
      }

      // Update session round
      db.prepare(`
        UPDATE arena_sessions
        SET current_round = ?
        WHERE id = ?
      `).run(roundNumber, sessionId);

      return NextResponse.json({ success: true, results });
    } catch (error: any) {
      console.error('Battle error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
