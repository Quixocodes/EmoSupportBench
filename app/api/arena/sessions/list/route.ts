// app/api/arena/sessions/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 优化：使用单个查询获取所有需要的数据，避免 N+1 查询问题
    const sessions = db.prepare(`
      SELECT 
        s.*,
        ea.model_name as expert_a_model,
        eb.model_name as expert_b_model,
        ec.model_name as expert_c_model,
        (SELECT COUNT(*) FROM arena_scores WHERE session_id = s.id) as total_scores,
        (SELECT COUNT(DISTINCT dimension_id) FROM arena_scores WHERE session_id = s.id AND is_agreed = 1) as agreed_dimensions,
        (SELECT COUNT(DISTINCT dimension_id) FROM arena_judgments WHERE session_id = s.id) as judged_dimensions
      FROM arena_sessions s
      LEFT JOIN arena_experts ea ON s.expert_a_id = ea.id
      LEFT JOIN arena_experts eb ON s.expert_b_id = eb.id
      LEFT JOIN arena_experts ec ON s.expert_c_id = ec.id
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    // 获取总数
    const totalResult = db.prepare(`
      SELECT COUNT(*) as total FROM arena_sessions
    `).get() as { total: number };

    return NextResponse.json({
      sessions,
      total: totalResult.total,
      page,
      limit,
      totalPages: Math.ceil(totalResult.total / limit)
    });
  } catch (error: any) {
    console.error('Failed to load sessions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}