// app/api/arena-batch-queue/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getArenaBatchQueue,
  getArenaBatchTasks,
  pauseArenaBatchQueue,
  resumeArenaBatchQueue,
  cancelArenaBatchQueue,
  deleteArenaBatchQueue,
  arenaBatchExecutor
} from '@/lib/arenaBatchQueue';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const queueId = Number(params.id);

    const queue = getArenaBatchQueue(queueId);
    if (!queue) {
      return NextResponse.json({ error: 'Queue not found' }, { status: 404 });
    }

    const tasks = getArenaBatchTasks(queueId);
    const isRunning = arenaBatchExecutor.isQueueRunning(queueId);
    const isPaused = arenaBatchExecutor.isQueuePaused(queueId);

    return NextResponse.json({ ...queue, tasks, isRunning, isPaused });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const queueId = Number(params.id);
    const { action } = await request.json();

    switch (action) {
      case 'pause':
        pauseArenaBatchQueue(queueId);
        break;
      case 'resume':
        resumeArenaBatchQueue(queueId);
        if (!arenaBatchExecutor.isQueueRunning(queueId)) {
          arenaBatchExecutor.executeQueue(queueId).catch(console.error);
        }
        break;
      case 'cancel':
        cancelArenaBatchQueue(queueId);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    deleteArenaBatchQueue(Number(params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
