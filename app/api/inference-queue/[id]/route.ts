import { NextRequest, NextResponse } from 'next/server';
import { 
  getInferenceQueue, 
  getInferenceQueueTasks,
  cancelInferenceQueue,
  pauseInferenceQueue,
  resumeInferenceQueue,
  retryFailedInferenceTasks,
  deleteInferenceQueue,
  updateInferenceQueueConcurrency,
  inferenceQueueExecutor
} from '@/lib/taskQueue';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const queueId = Number(params.id);
    
    const queue = getInferenceQueue(queueId);
    if (!queue) {
      return NextResponse.json({ error: 'Queue not found' }, { status: 404 });
    }

    const tasks = getInferenceQueueTasks(queueId);
    const isRunning = inferenceQueueExecutor.isQueueRunning(queueId);
    const isPaused = inferenceQueueExecutor.isQueuePaused(queueId);

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
        cancelInferenceQueue(queueId);
        break;
      case 'pause':
        pauseInferenceQueue(queueId);
        break;
      case 'resume':
        resumeInferenceQueue(queueId);
        if (!inferenceQueueExecutor.isQueueRunning(queueId)) {
          inferenceQueueExecutor.executeQueue(queueId).catch(console.error);
        }
        break;
      case 'retry':
        retryFailedInferenceTasks(queueId);
        inferenceQueueExecutor.executeQueue(queueId).catch(console.error);
        break;
      case 'update_concurrency':
        if (maxConcurrency) {
          updateInferenceQueueConcurrency(queueId, maxConcurrency);
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
    deleteInferenceQueue(Number(params.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
