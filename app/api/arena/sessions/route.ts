// app/api/arena/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { scoreAnswer } from '@/lib/openrouter';

// 创建新会话
export async function POST(request: NextRequest) {
  try {
    const { question, answer, maxRounds, expertAId, expertBId, expertCId } = await request.json();
    
    const result = db.prepare(`
      INSERT INTO arena_sessions 
      (question, answer, max_rounds, expert_a_id, expert_b_id, expert_c_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(question, answer, maxRounds, expertAId, expertBId, expertCId);
    
    return NextResponse.json({ sessionId: result.lastInsertRowid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 获取会话详情
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    const session = db.prepare(`
      SELECT s.*, 
             ea.model_name as expert_a_model, ea.prompt as expert_a_prompt,
             eb.model_name as expert_b_model, eb.prompt as expert_b_prompt,
             ec.model_name as expert_c_model, ec.prompt as expert_c_prompt
      FROM arena_sessions s
      LEFT JOIN arena_experts ea ON s.expert_a_id = ea.id
      LEFT JOIN arena_experts eb ON s.expert_b_id = eb.id
      LEFT JOIN arena_experts ec ON s.expert_c_id = ec.id
      WHERE s.id = ?
    `).get(sessionId);
    
    const scores = db.prepare(`
      SELECT * FROM arena_scores 
      WHERE session_id = ? 
      ORDER BY dimension_id, round_number, expert_type
    `).all(sessionId);
    
    const judgments = db.prepare(`
      SELECT * FROM arena_judgments 
      WHERE session_id = ?
    `).all(sessionId);
    
    return NextResponse.json({ session, scores, judgments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
