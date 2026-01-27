// app/api/answers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAnswers, getAnswersByModelPaginated } from '@/lib/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (modelId) {
      const answers = getAnswersByModelPaginated(Number(modelId), page, limit);
      return NextResponse.json(answers);
    } else {
      const answers = getAnswers();
      return NextResponse.json(answers);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch answers' }, { status: 500 });
  }
}
