// app/api/arena-batch-queue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  createArenaBatchQueue,
  addArenaBatchTask,
  updateArenaBatchQueueTotalTasks,
  getAllArenaBatchQueues,
  arenaBatchExecutor
} from '@/lib/arenaBatchQueue';
import db from '@/lib/db';

export async function GET() {
  try {
    const queues = getAllArenaBatchQueues();
    return NextResponse.json(queues);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      maxConcurrency = 2,
      maxRounds = 3,
      expertAId,
      expertBId,
      expertCId,
      answerIds = []
    } = await request.json();

    const queueId = createArenaBatchQueue(
      maxConcurrency,
      maxRounds,
      expertAId,
      expertBId,
      expertCId
    );

    let addedCount = 0;

    for (const answerId of answerIds) {
      // 获取答案的问题ID
      const answer = db.prepare('SELECT question_id FROM answers WHERE id = ?')
        .get(answerId) as any;

      if (answer) {
        const added = addArenaBatchTask(queueId, answer.question_id, answerId);
        if (added) addedCount++;
      }
    }

    updateArenaBatchQueueTotalTasks(queueId);

    if (addedCount > 0) {
      arenaBatchExecutor.executeQueue(queueId).catch(console.error);
    }

    return NextResponse.json({
      queueId,
      addedCount,
      message: `成功创建批量竞技场任务，添加了 ${addedCount} 个任务`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
