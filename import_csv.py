#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导入CSV数据到数据库
"""

import csv
import sqlite3
import sys
import io

# 设置标准输出编码
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    # 连接数据库
    conn = sqlite3.connect('benchmark.db')
    cursor = conn.cursor()

    # 读取CSV文件
    csv_file = '8道题×13个答案.csv'

    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header = next(reader)

        print(f"CSV列头: {header}")

        # 解析模型名称（从第2列开始，跳过空列）
        model_names = []
        for i, name in enumerate(header[1:], start=1):
            name = name.strip()
            if name:  # 只跳过空列
                model_names.append((i, name))

        print(f"找到 {len(model_names)} 个模型:")
        for idx, name in model_names:
            print(f"  列{idx}: {name}")

        # 确保模型存在于数据库中
        model_id_map = {}
        for col_idx, model_name in model_names:
            # 检查模型是否已存在
            cursor.execute("SELECT id FROM models WHERE name = ?", (model_name,))
            row = cursor.fetchone()
            if row:
                model_id_map[col_idx] = row[0]
                print(f"模型已存在: {model_name} (ID: {row[0]})")
            else:
                cursor.execute("INSERT INTO models (name) VALUES (?)", (model_name,))
                model_id_map[col_idx] = cursor.lastrowid
                print(f"新建模型: {model_name} (ID: {cursor.lastrowid})")

        conn.commit()

        # 读取问题和答案
        questions_added = 0
        answers_added = 0

        for row_num, row in enumerate(reader, start=2):
            if not row or not row[0].strip():
                continue

            question_content = row[0].strip()

            # 检查问题是否已存在
            cursor.execute("SELECT id FROM questions WHERE content = ?", (question_content,))
            q_row = cursor.fetchone()
            if q_row:
                question_id = q_row[0]
                print(f"问题已存在 (ID: {question_id}): {question_content[:50]}...")
            else:
                cursor.execute("INSERT INTO questions (content) VALUES (?)", (question_content,))
                question_id = cursor.lastrowid
                questions_added += 1
                print(f"新建问题 (ID: {question_id}): {question_content[:50]}...")

            # 添加各模型的答案
            for col_idx, model_name in model_names:
                if col_idx < len(row):
                    answer_content = row[col_idx].strip() if row[col_idx] else ""

                    if answer_content:
                        model_id = model_id_map[col_idx]

                        # 检查答案是否已存在
                        cursor.execute(
                            "SELECT id FROM answers WHERE question_id = ? AND model_id = ?",
                            (question_id, model_id)
                        )
                        a_row = cursor.fetchone()

                        if not a_row:
                            cursor.execute(
                                "INSERT INTO answers (question_id, model_id, content) VALUES (?, ?, ?)",
                                (question_id, model_id, answer_content)
                            )
                            answers_added += 1

        conn.commit()

        print(f"\n导入完成!")
        print(f"新增问题: {questions_added}")
        print(f"新增答案: {answers_added}")

    conn.close()

if __name__ == "__main__":
    main()
