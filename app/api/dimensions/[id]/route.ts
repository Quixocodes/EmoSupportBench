import { NextRequest, NextResponse } from 'next/server';
import { getDimension, updateDimension, deleteDimension } from '@/lib/queries';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const dimension = getDimension(Number(params.id));
    if (!dimension) {
      return NextResponse.json({ error: 'Dimension not found' }, { status: 404 });
    }
    return NextResponse.json(dimension);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dimension' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { name, prompt } = await request.json();
    updateDimension(Number(params.id), name, prompt);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update dimension' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    deleteDimension(Number(params.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete dimension' }, { status: 500 });
  }
}
