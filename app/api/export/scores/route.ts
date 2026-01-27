import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import db from '@/lib/db';
import { extractScore } from '@/lib/queries';

export async function POST(request: NextRequest) {
  try {
    const { modelIds, questionIds } = await request.json();

    if (!modelIds || !questionIds || modelIds.length === 0 || questionIds.length === 0) {
      return NextResponse.json({ error: '请选择至少一个模型和一个问题' }, { status: 400 });
    }

    console.log(`[Export] 开始导出评分数据`);
    console.log(`  - 模型数量: ${modelIds.length}`);
    console.log(`  - 问题数量: ${questionIds.length}`);

    // 获取所有维度
    const dimensions = db.prepare('SELECT * FROM dimensions ORDER BY id').all() as any[];
    
    // 获取模型信息
    const models = db.prepare(`
      SELECT * FROM models 
      WHERE id IN (${modelIds.map(() => '?').join(',')})
      ORDER BY name
    `).all(...modelIds) as any[];

    // 获取问题信息
    const questions = db.prepare(`
      SELECT * FROM questions 
      WHERE id IN (${questionIds.map(() => '?').join(',')})
      ORDER BY id
    `).all(...questionIds) as any[];

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 为每个模型创建一个工作表
    for (const model of models) {
      console.log(`[Export] 处理模型: ${model.name}`);

      // 创建表头
      const headers = ['问题', ...dimensions.map(d => d.name)];
      const sheetData: any[][] = [headers];

      // 为每个问题添加一行数据
      for (const question of questions) {
        const row: any[] = [question.content];

        // 获取该问题和模型的答案
        const answer = db.prepare(`
          SELECT * FROM answers 
          WHERE question_id = ? AND model_id = ?
        `).get(question.id, model.id) as any;

        if (!answer) {
          // 如果没有答案，所有维度都标记为"未回答"
          dimensions.forEach(() => row.push('未回答'));
        } else {
          // 获取每个维度的评分
          for (const dimension of dimensions) {
            const score = db.prepare(`
              SELECT * FROM scores 
              WHERE answer_id = ? AND dimension_id = ?
            `).get(answer.id, dimension.id) as any;

            if (!score || !score.score) {
              row.push('未评分');
            } else {
              // 尝试提取分数
              const scoreValue = extractScore(score.score);
              if (scoreValue !== null) {
                row.push(scoreValue);
              } else {
                // 如果无法提取分数，显示原始文本的前50个字符
                row.push(score.score.substring(0, 50) + '...');
              }
            }
          }
        }

        sheetData.push(row);
      }

      // 创建工作表
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // 设置列宽
      const colWidths = [
        { wch: 50 }, // 问题列宽度
        ...dimensions.map(() => ({ wch: 15 })) // 维度列宽度
      ];
      worksheet['!cols'] = colWidths;

      // 使用安全的工作表名称（Excel工作表名称限制为31字符，且不能包含特殊字符）
      let sheetName = model.name.replace(/[:\\/?*\[\]]/g, '_').substring(0, 31);
      
      // 确保工作表名称唯一
      let counter = 1;
      let finalSheetName = sheetName;
      while (workbook.SheetNames.includes(finalSheetName)) {
        const suffix = `_${counter}`;
        finalSheetName = sheetName.substring(0, 31 - suffix.length) + suffix;
        counter++;
      }

      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(workbook, worksheet, finalSheetName);

      console.log(`[Export] ✅ 完成工作表: ${finalSheetName} (${sheetData.length - 1} 行数据)`);
    }

    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    console.log(`[Export] ✅ 导出完成`);
    console.log(`  - 工作表数量: ${workbook.SheetNames.length}`);
    console.log(`  - 文件大小: ${(excelBuffer.length / 1024).toFixed(2)} KB`);

    // 生成文件名（使用英文，避免编码问题）
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `scores_export_${timestamp}.xlsx`;
    
    // 使用 RFC 5987 编码格式支持中文文件名
    const encodedFilename = encodeURIComponent(`评分结果_${timestamp}.xlsx`);

    // 返回文件
    return new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      },
    });
  } catch (error: any) {
    console.error('[Export] ❌ 导出失败:', error);
    return NextResponse.json({ error: error.message || '导出失败' }, { status: 500 });
  }
}
