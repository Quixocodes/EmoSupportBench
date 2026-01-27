import { NextRequest, NextResponse } from 'next/server';
import { getAnswer, getScoresByAnswer } from '@/lib/queries';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const answerId = Number(params.id);

    if (isNaN(answerId)) {
      return NextResponse.json({ error: 'Invalid answer ID' }, { status: 400 });
    }

    const answer = getAnswer(answerId);
    
    if (!answer) {
      return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
    }

    // 获取评分，确保返回数组
    const scores = getScoresByAnswer(answerId) || [];

    return NextResponse.json({
      answer,
      scores: Array.isArray(scores) ? scores : []
    });
  } catch (error) {
    console.error('Error fetching answer:', error);
    return NextResponse.json({ error: 'Failed to fetch answer' }, { status: 500 });
  }
}
