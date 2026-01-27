import { NextRequest, NextResponse } from 'next/server';
import { getScores, getScoresByAnswer } from '@/lib/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const answerId = searchParams.get('answerId');

    if (answerId) {
      const scores = getScoresByAnswer(Number(answerId));
      return NextResponse.json(scores);
    } else {
      const scores = getScores();
      return NextResponse.json(scores);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
}
