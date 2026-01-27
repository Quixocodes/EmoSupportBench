import { NextResponse } from 'next/server';
import { getEmptyScoresCount, getEmptyScores } from '@/lib/taskQueue';

export async function GET() {
  try {
    const count = getEmptyScoresCount();
    const scores = getEmptyScores();
    
    return NextResponse.json({ 
      count,
      scores 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
