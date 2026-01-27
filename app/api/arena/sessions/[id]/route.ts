// app/api/arena/sessions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const sessionId = Number(params.id);

    console.log(`[DELETE Session] 删除会话 #${sessionId}`);

    // 使用事务确保数据一致性
    const deleteSession = db.transaction(() => {
      // 1. 先删除评分记录
      const scoresDeleted = db.prepare('DELETE FROM arena_scores WHERE session_id = ?')
        .run(sessionId);
      console.log(`  - 删除了 ${scoresDeleted.changes} 条评分记录`);

      // 2. 删除裁决记录
      const judgmentsDeleted = db.prepare('DELETE FROM arena_judgments WHERE session_id = ?')
        .run(sessionId);
      console.log(`  - 删除了 ${judgmentsDeleted.changes} 条裁决记录`);

      // 3. 删除批量任务关联（如果有）
      const tasksUpdated = db.prepare(`
        UPDATE arena_batch_tasks 
        SET session_id = NULL 
        WHERE session_id = ?
      `).run(sessionId);
      console.log(`  - 更新了 ${tasksUpdated.changes} 个批量任务`);

      // 4. 最后删除会话本身
      const sessionDeleted = db.prepare('DELETE FROM arena_sessions WHERE id = ?')
        .run(sessionId);
      console.log(`  - 删除了会话记录`);

      return sessionDeleted;
    });

    deleteSession();

    console.log(`[DELETE Session] ✅ 会话 #${sessionId} 删除成功`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[DELETE Session] ❌ 删除失败:`, error);
    return NextResponse.json({ 
      error: error.message,
      details: '删除会话失败，请确保没有其他地方引用此会话'
    }, { status: 500 });
  }
}
