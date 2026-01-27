import { NextRequest, NextResponse } from 'next/server';
import { 
  getQueue, 
  getQueueTasks,
  cancelQueue,
  pauseQueue,
  resumeQueue,
  retryFailedTasks,
  deleteQueue,
  updateQueueConcurrency,
  taskQueueExecutor
} from '@/lib/taskQueue';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const queueId = Number(params.id);
    
    const queue = getQueue(queueId);
    if (!queue) {
      return NextResponse.json({ error: 'Queue not found' }, { status: 404 });
    }

    const tasks = getQueueTasks(queueId);
    const isRunning = taskQueueExecutor.isQueueRunning(queueId);
    const isPaused = taskQueueExecutor.isQueuePaused(queueId);

    return NextResponse.json({ 
      ...queue, 
      tasks,
      isRunning,
      isPaused
    });
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
    const body = await request.json();
    const { action, maxConcurrency } = body;

    switch (action) {
      case 'cancel':
        cancelQueue(queueId);
        break;
      case 'pause':
        pauseQueue(queueId);
        break;
      case 'resume':
        resumeQueue(queueId);
        if (!taskQueueExecutor.isQueueRunning(queueId)) {
          taskQueueExecutor.executeQueue(queueId).catch(console.error);
        }
        break;
      case 'retry':
        retryFailedTasks(queueId);
        taskQueueExecutor.executeQueue(queueId).catch(console.error);
        break;
      case 'update_concurrency':
        if (maxConcurrency) {
          updateQueueConcurrency(queueId, maxConcurrency);
        }
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
    deleteQueue(Number(params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
