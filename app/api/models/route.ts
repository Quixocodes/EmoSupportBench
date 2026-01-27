import { NextRequest, NextResponse } from 'next/server';
import { getModels, createModel } from '@/lib/queries';

export async function GET() {
  try {
    const models = getModels();
    return NextResponse.json(models);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    const result = createModel(name);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create model' }, { status: 500 });
  }
}
