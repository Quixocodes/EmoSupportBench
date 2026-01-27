import { NextRequest, NextResponse } from 'next/server';
import { getDimensions, createDimension } from '@/lib/queries';

export async function GET() {
  try {
    const dimensions = getDimensions();
    return NextResponse.json(dimensions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dimensions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, prompt } = await request.json();
    const result = createDimension(name, prompt);
    return NextResponse.json({ id: result.lastInsertRowid });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create dimension' }, { status: 500 });
  }
}
