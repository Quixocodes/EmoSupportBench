import { NextRequest, NextResponse } from 'next/server';
import { createAnswer } from '@/lib/queries';
import { getModelAnswer } from '@/lib/openrouter';

export async function POST(request: NextRequest) {
  try {
    const { modelId, questionId, modelName, questionContent } = await request.json();

    // 调用 OpenRouter API 获取答案
    const answerContent = await getModelAnswer(modelName, questionContent);

    // 保存答案到数据库
    const result = createAnswer(questionId, modelId, answerContent);

    return NextResponse.json({
      id: result.lastInsertRowid,
      content: answerContent
    });
  } catch (error: any) {
    console.error('Test error:', error);
    return NextResponse.json({ error: error.message || 'Failed to test' }, { status: 500 });
  }
}
