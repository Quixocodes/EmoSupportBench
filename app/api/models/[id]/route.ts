import { NextRequest, NextResponse } from 'next/server';
import { getModel, updateModel, deleteModel } from '@/lib/queries';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const model = getModel(Number(params.id));
    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }
    return NextResponse.json(model);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch model' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { name } = await request.json();
    updateModel(Number(params.id), name);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update model' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    deleteModel(Number(params.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete model' }, { status: 500 });
  }
}
