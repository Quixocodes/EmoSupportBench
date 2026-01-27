// app/api/models/calculate-scores/route.ts
import { NextResponse } from 'next/server';
import { getModels, calculateModelScoreData, updateModelScore } from '@/lib/queries';

export async function POST() {
  try {
    const models = getModels() as Array<{ id: number; name: string }>;
    const results: Array<{ 
      id: number; 
      name: string; 
      scoreData: any;
      success: boolean;
    }> = [];

    for (const model of models) {
      const scoreData = calculateModelScoreData(model.id);
      
      if (scoreData !== null) {
        // 将评分数据转换为 JSON 字符串存储
        const scoreJson = JSON.stringify(scoreData);
        updateModelScore(model.id, scoreJson);
        
        results.push({
          id: model.id,
          name: model.name,
          scoreData: scoreData,
          success: true
        });
      } else {
        results.push({
          id: model.id,
          name: model.name,
          scoreData: null,
          success: false
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      results,
      message: `成功计算 ${successCount} 个模型的评分`
    });
  } catch (error: any) {
    console.error('Calculate scores error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
