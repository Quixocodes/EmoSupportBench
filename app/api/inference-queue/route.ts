import { NextRequest, NextResponse } from 'next/server';
import { 
  createInferenceQueue,
  addInferenceTask,
  updateInferenceQueueTotalTasks,
  getAllInferenceQueues,
  deleteInferenceQueue,
  inferenceQueueExecutor
} from '@/lib/taskQueue';
import { getQuestions } from '@/lib/queries';
import db from '@/lib/db';

// 获取所有推理队列
export async function GET() {
  try {
    const queues = getAllInferenceQueues();
    
    // 添加运行状态
    const queuesWithStatus = queues.map(queue => ({
      ...queue,
      isRunning: inferenceQueueExecutor.isQueueRunning(queue.id),
      isPaused: inferenceQueueExecutor.isQueuePaused(queue.id)
    }));
    
    return NextResponse.json(queuesWithStatus);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 创建新的推理队列
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxConcurrency = 3, questionIds = [], modelIds = [] } = body;

    // 创建队列
    const queueId = createInferenceQueue(maxConcurrency);

    let addedCount = 0;

    // 如果指定了问题和模型，添加任务
    if (questionIds.length > 0 && modelIds.length > 0) {
      for (const questionId of questionIds) {
        for (const modelId of modelIds) {
          const added = addInferenceTask(queueId, questionId, modelId);
          if (added) addedCount++;
        }
      }
    }

    // 更新总任务数
    updateInferenceQueueTotalTasks(queueId);

    // 如果有任务，自动启动队列
    if (addedCount > 0) {
      inferenceQueueExecutor.executeQueue(queueId).catch(console.error);
    }

    return NextResponse.json({ 
      queueId, 
      addedCount,
      message: `成功创建队列，添加了 ${addedCount} 个推理任务` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 删除队列
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queueId = Number(searchParams.get('id'));
    
    deleteInferenceQueue(queueId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
