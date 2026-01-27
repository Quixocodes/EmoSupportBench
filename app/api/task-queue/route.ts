// app/api/task-queue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { 
  createTaskQueue, 
  addTaskItem, 
  updateQueueTotalTasks,
  getAllQueues,
  taskQueueExecutor,
  cleanEmptyScores
} from '@/lib/taskQueue';
import { getAnswers, getDimensions } from '@/lib/queries';

export async function GET() {
  try {
    const queues = getAllQueues();
    return NextResponse.json(queues);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      maxConcurrency = 3, 
      modelIds = [], 
      questionIds = [], // 新增：选中的问题ID
      cleanEmpty = true,
      overwriteMode = false // 新增：覆盖模式
    } = await request.json();

    // 如果需要，先清理空评分
    let cleanedCount = 0;
    if (cleanEmpty && !overwriteMode) { // 覆盖模式下不清理空评分
      cleanedCount = cleanEmptyScores();
      console.log(`Cleaned ${cleanedCount} empty scores`);
    }

    // 创建队列
    const queueId = createTaskQueue(maxConcurrency);

    // 获取所有答案和维度
    const allAnswers = getAnswers() as any[];
    const dimensions = getDimensions() as any[];

    // 过滤答案
    let answers = allAnswers;
    
    // 按模型过滤
    if (modelIds.length > 0) {
      answers = answers.filter((a: any) => modelIds.includes(a.model_id));
    }
    
    // 按问题过滤（新增）
    if (questionIds.length > 0) {
      answers = answers.filter((a: any) => questionIds.includes(a.question_id));
    }

    let addedCount = 0;
    let skippedCount = 0;

    // 为每个答案的每个维度创建任务
    for (const answer of answers) {
      for (const dimension of dimensions) {
        const added = addTaskItem(queueId, answer.id, dimension.id, overwriteMode);
        if (added) {
          addedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    // 更新总任务数
    updateQueueTotalTasks(queueId);

    // 异步开始执行队列
    taskQueueExecutor.executeQueue(queueId).catch(console.error);

    const message = overwriteMode
      ? `成功创建队列（覆盖模式），添加了 ${addedCount} 个任务${cleanedCount > 0 ? `，清理了 ${cleanedCount} 个空评分` : ''}`
      : `成功创建队列（增量模式），添加了 ${addedCount} 个任务，跳过了 ${skippedCount} 个已完成的任务${cleanedCount > 0 ? `，清理了 ${cleanedCount} 个空评分` : ''}`;

    return NextResponse.json({ 
      queueId,
      addedCount,
      skippedCount,
      cleanedCount,
      message
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
