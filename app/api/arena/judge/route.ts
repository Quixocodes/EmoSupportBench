// app/api/arena/judge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { callOpenRouter } from '@/lib/openrouter';
import { getServerTranslation } from '@/lib/i18n/server';

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

export async function POST(request: NextRequest) {
  try {
    const { sessionId, locale = 'en' } = await request.json();
    const t = getServerTranslation(locale);

    // Get session info
    const session = db.prepare(`
      SELECT s.*,
             ec.model_name as expert_c_model, ec.prompt as expert_c_prompt
      FROM arena_sessions s
      LEFT JOIN arena_experts ec ON s.expert_c_id = ec.id
      WHERE s.id = ?
    `).get(sessionId) as any;

    // Get all disagreed dimensions
    const disagreedDimensions = db.prepare(`
      SELECT DISTINCT dimension_id
      FROM arena_scores
      WHERE session_id = ? AND is_agreed = 0
    `).all(sessionId) as any[];

    if (disagreedDimensions.length === 0) {
      return NextResponse.json({ message: 'No disagreements to judge' });
    }

    // Get all historical scores
    const allScores = db.prepare(`
      SELECT * FROM arena_scores
      WHERE session_id = ?
      ORDER BY dimension_id, round_number, expert_type
    `).all(sessionId) as any[];

    // Get dimension info
    const dimensions = db.prepare(`
      SELECT * FROM dimensions
      WHERE id IN (${disagreedDimensions.map(() => '?').join(',')})
    `).all(...disagreedDimensions.map(d => d.dimension_id)) as any[];

    // Judge each disagreed dimension
    const judgmentTasks = dimensions.map(async (dimension) => {
      const scoresForDimension = allScores.filter(s => s.dimension_id === dimension.id);

      let prompt = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      prompt += t('prompt.judgeTitle') + '\n';
      prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      prompt += `📋 ${t('prompt.judgeDimension', { name: dimension.name })}\n\n`;
      prompt += `📖 ${t('prompt.judgeCriteria')}\n${dimension.prompt}\n\n`;

      prompt += `❓ ${t('prompt.judgeOriginalQuestion')}\n${session.question}\n\n`;
      prompt += `💬 ${t('prompt.judgeAnswer')}\n${session.answer}\n\n`;

      prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      prompt += t('prompt.judgeHistoryTitle') + '\n';
      prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      // Organize by round
      const maxRound = Math.max(...scoresForDimension.map(s => s.round_number));

      for (let round = 1; round <= maxRound; round++) {
        const roundScores = scoresForDimension.filter(s => s.round_number === round);
        const scoreA = roundScores.find(s => s.expert_type === 'A');
        const scoreB = roundScores.find(s => s.expert_type === 'B');

        prompt += `\n🔵 ${t('prompt.judgeRound', { round })}\n`;
        prompt += `${'═'.repeat(50)}\n\n`;

        if (scoreA) {
          prompt += `👤 ${t('prompt.judgeExpertA')}\n`;
          prompt += `${t('prompt.judgeScoreLabel', { score: scoreA.score_value !== null ? scoreA.score_value : t('prompt.judgeScoreUnknown') })}\n`;
          prompt += `${t('prompt.judgeDetailLabel')}\n${scoreA.score_text}\n\n`;
          prompt += `${'-'.repeat(50)}\n\n`;
        }

        if (scoreB) {
          prompt += `👤 ${t('prompt.judgeExpertB')}\n`;
          prompt += `${t('prompt.judgeScoreLabel', { score: scoreB.score_value !== null ? scoreB.score_value : t('prompt.judgeScoreUnknown') })}\n`;
          prompt += `${t('prompt.judgeDetailLabel')}\n${scoreB.score_text}\n\n`;
        }

        if (round < maxRound) {
          prompt += `\n`;
        }
      }

      prompt += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      prompt += t('prompt.judgeTaskTitle') + '\n';
      prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

      prompt += t('prompt.judgeTaskIntro') + '\n\n';
      prompt += t('prompt.judgeAnalyze') + '\n';
      prompt += t('prompt.judgeAnalyze1') + '\n';
      prompt += t('prompt.judgeAnalyze2') + '\n';
      prompt += t('prompt.judgeAnalyze3') + '\n\n';

      prompt += t('prompt.judgeEvaluate') + '\n';
      prompt += t('prompt.judgeEvaluate1') + '\n';
      prompt += t('prompt.judgeEvaluate2') + '\n';
      prompt += t('prompt.judgeEvaluate3') + '\n\n';

      prompt += t('prompt.judgeComprehensive') + '\n';
      prompt += t('prompt.judgeComprehensive1') + '\n';
      prompt += t('prompt.judgeComprehensive2') + '\n';
      prompt += t('prompt.judgeComprehensive3') + '\n\n';

      prompt += t('prompt.judgeOutput') + '\n';
      prompt += t('prompt.judgeOutputIntro') + '\n';
      prompt += t('prompt.judgeOutput1') + '\n';
      prompt += t('prompt.judgeOutput2') + '\n';
      prompt += t('prompt.judgeOutput3') + '\n';
      prompt += t('prompt.judgeOutput4') + '\n\n';

      prompt += t('prompt.judgeReminder') + '\n';
      prompt += t('prompt.judgeReminder1') + '\n';
      prompt += t('prompt.judgeReminder2') + '\n';
      prompt += t('prompt.judgeReminder3') + '\n';
      prompt += t('prompt.judgeReminder4') + '\n';
      prompt += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

      const judgmentText = await callOpenRouter(session.expert_c_model, [
        { role: 'system', content: session.expert_c_prompt },
        { role: 'user', content: prompt }
      ]);

      const finalScore = extractScore(judgmentText);

      // Save judgment
      db.prepare(`
        INSERT OR REPLACE INTO arena_judgments
        (session_id, dimension_id, final_score, judgment_text)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, dimension.id, finalScore, judgmentText);

      return {
        dimensionId: dimension.id,
        dimensionName: dimension.name,
        finalScore,
        judgmentText
      };
    });

    const judgments = await Promise.all(judgmentTasks);

    // Update session status
    db.prepare(`
      UPDATE arena_sessions
      SET status = 'judged', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sessionId);

    return NextResponse.json({ success: true, judgments });
  } catch (error: any) {
    console.error('Judge error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
