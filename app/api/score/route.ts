import { NextRequest, NextResponse } from 'next/server';
import { createScore, getDimensions } from '@/lib/queries';
import { scoreAnswer } from '@/lib/openrouter';

export async function POST(request: NextRequest) {
  try {
    const { answerId, questionContent, answerContent, locale = 'en' } = await request.json();

    // Get all scoring dimensions
    const dimensions = getDimensions() as Array<{ id: number; name: string; prompt: string }>;

    // Score each dimension
    const scores = [];
    for (const dimension of dimensions) {
      const scoreContent = await scoreAnswer(questionContent, answerContent, dimension.prompt, locale);
      createScore(answerId, dimension.id, scoreContent);
      scores.push({
        dimension_id: dimension.id,
        dimension_name: dimension.name,
        score: scoreContent
      });
    }

    return NextResponse.json({ scores });
  } catch (error: any) {
    console.error('Score error:', error);
    return NextResponse.json({ error: error.message || 'Failed to score' }, { status: 500 });
  }
}
