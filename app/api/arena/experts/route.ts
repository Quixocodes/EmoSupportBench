// app/api/arena/experts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

// 获取所有专家配置
export async function GET() {
  try {
    const experts = db.prepare(`
      SELECT * FROM arena_experts 
      WHERE is_active = 1 
      ORDER BY expert_type
    `).all();
    
    return NextResponse.json(experts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 更新专家配置
export async function PUT(request: NextRequest) {
  try {
    const { id, model_name, prompt } = await request.json();
    
    db.prepare(`
      UPDATE arena_experts 
      SET model_name = ?, prompt = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(model_name, prompt, id);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
