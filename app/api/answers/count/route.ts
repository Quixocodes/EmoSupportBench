// app/api/answers/count/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAnswersCountByModel } from '@/lib/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
    }

    const count = getAnswersCountByModel(Number(modelId));
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch count' }, { status: 500 });
  }
}
