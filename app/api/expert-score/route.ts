import { NextRequest, NextResponse } from 'next/server';
import { getDimensions } from '@/lib/queries';
import { scoreAnswer } from '@/lib/openrouter';

export async function POST(request: NextRequest) {
  try {
    const { question, answer, locale = 'en' } = await request.json();

    // Get all scoring dimensions
    const dimensions = getDimensions() as Array<{ id: number; name: string; prompt: string }>;

    // Score each dimension
    const scores = [];
    for (const dimension of dimensions) {
      const scoreContent = await scoreAnswer(question, answer, dimension.prompt, locale);
      scores.push({
        dimension_name: dimension.name,
        dimension_prompt: dimension.prompt,
        score: scoreContent
      });
    }

    return NextResponse.json({ scores });
  } catch (error: any) {
    console.error('Expert score error:', error);
    return NextResponse.json({ error: error.message || 'Failed to score' }, { status: 500 });
  }
}
