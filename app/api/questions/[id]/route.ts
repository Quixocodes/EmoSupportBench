import { NextRequest, NextResponse } from 'next/server';
import { getQuestion, updateQuestion, deleteQuestion } from '@/lib/queries';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const question = getQuestion(Number(params.id));
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    return NextResponse.json(question);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { content } = await request.json();
    updateQuestion(Number(params.id), content);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    deleteQuestion(Number(params.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
  }
}
