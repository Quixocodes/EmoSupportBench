import { NextRequest, NextResponse } from 'next/server';
import { getQuestions, createQuestion } from '@/lib/queries';

export async function GET() {
  try {
    const questions = getQuestions();
    return NextResponse.json(questions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    const result = createQuestion(content);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}
