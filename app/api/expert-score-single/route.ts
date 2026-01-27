import { NextRequest, NextResponse } from 'next/server';
import { scoreAnswer } from '@/lib/openrouter';

export async function POST(request: NextRequest) {
  try {
    const { question, answer, dimensionName, dimensionPrompt, locale = 'en' } = await request.json();

    // Score single dimension
    const scoreContent = await scoreAnswer(question, answer, dimensionPrompt, locale);

    return NextResponse.json({
      dimension_name: dimensionName,
      dimension_prompt: dimensionPrompt,
      score: scoreContent
    });
  } catch (error: any) {
    console.error('Expert score error:', error);
    return NextResponse.json({ error: error.message || 'Failed to score' }, { status: 500 });
  }
}
