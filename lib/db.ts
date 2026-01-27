// lib/db.ts
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = path.join(process.cwd(), 'benchmark.db');

// Use globalThis to persist the database instance across HMR in development
const g = globalThis as typeof globalThis & {
  __sqliteDb?: DatabaseSync;
};

if (!g.__sqliteDb) {
  g.__sqliteDb = new DatabaseSync(dbPath);
}

const rawDb = g.__sqliteDb;

// Enable foreign key constraints
rawDb.exec('PRAGMA foreign_keys = ON');

// Create tables
rawDb.exec(`
  -- 问题表
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL
  );

  -- LLM模型表
  CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    average_score TEXT DEFAULT NULL
  );

  -- LLM回答表
  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
  );

  -- 评分维度表
  CREATE TABLE IF NOT EXISTS dimensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    prompt TEXT NOT NULL
  );

  -- LLM评分表
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    answer_id INTEGER NOT NULL,
    dimension_id INTEGER NOT NULL,
    score TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE CASCADE,
    FOREIGN KEY (dimension_id) REFERENCES dimensions(id) ON DELETE CASCADE,
    UNIQUE(answer_id, dimension_id)
  );

  -- 任务队列表（评分）
  CREATE TABLE IF NOT EXISTS task_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    failed_tasks INTEGER NOT NULL DEFAULT 0,
    current_task TEXT,
    error_message TEXT,
    max_concurrency INTEGER NOT NULL DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
  );

  -- 子任务表（评分）
  CREATE TABLE IF NOT EXISTS task_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER NOT NULL,
    answer_id INTEGER NOT NULL,
    dimension_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (queue_id) REFERENCES task_queue(id) ON DELETE CASCADE,
    FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE CASCADE,
    FOREIGN KEY (dimension_id) REFERENCES dimensions(id) ON DELETE CASCADE
  );

  -- 推理队列表
  CREATE TABLE IF NOT EXISTS inference_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    failed_tasks INTEGER NOT NULL DEFAULT 0,
    current_task TEXT,
    error_message TEXT,
    max_concurrency INTEGER NOT NULL DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
  );

  -- 推理子任务表
  CREATE TABLE IF NOT EXISTS inference_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (queue_id) REFERENCES inference_queue(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
  );

  -- 创建索引以提高查询性能
  CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
  CREATE INDEX IF NOT EXISTS idx_answers_model ON answers(model_id);
  CREATE INDEX IF NOT EXISTS idx_scores_answer ON scores(answer_id);
  CREATE INDEX IF NOT EXISTS idx_scores_dimension ON scores(dimension_id);
  CREATE INDEX IF NOT EXISTS idx_task_items_queue ON task_items(queue_id);
  CREATE INDEX IF NOT EXISTS idx_task_items_status ON task_items(status);
  CREATE INDEX IF NOT EXISTS idx_scores_unique ON scores(answer_id, dimension_id);
  CREATE INDEX IF NOT EXISTS idx_inference_tasks_queue ON inference_tasks(queue_id);
  CREATE INDEX IF NOT EXISTS idx_inference_tasks_status ON inference_tasks(status);

  -- 批量竞技场队列表
  CREATE TABLE IF NOT EXISTS arena_batch_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'paused')),
    total_tasks INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    failed_tasks INTEGER NOT NULL DEFAULT 0,
    current_task TEXT,
    error_message TEXT,
    max_concurrency INTEGER NOT NULL DEFAULT 2,
    max_rounds INTEGER NOT NULL DEFAULT 3,
    expert_a_id INTEGER NOT NULL,
    expert_b_id INTEGER NOT NULL,
    expert_c_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (expert_a_id) REFERENCES arena_experts(id),
    FOREIGN KEY (expert_b_id) REFERENCES arena_experts(id),
    FOREIGN KEY (expert_c_id) REFERENCES arena_experts(id)
  );

  -- 批量竞技场任务表
  CREATE TABLE IF NOT EXISTS arena_batch_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_id INTEGER NOT NULL,
    session_id INTEGER,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    current_round INTEGER DEFAULT 0,
    is_agreed INTEGER DEFAULT 0,
    needs_judgment INTEGER DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (queue_id) REFERENCES arena_batch_queue(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (answer_id) REFERENCES answers(id),
    FOREIGN KEY (session_id) REFERENCES arena_sessions(id)
  );

  -- 批量竞技场索引
  CREATE INDEX IF NOT EXISTS idx_arena_batch_tasks_queue ON arena_batch_tasks(queue_id);
  CREATE INDEX IF NOT EXISTS idx_arena_batch_tasks_status ON arena_batch_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_arena_batch_tasks_session ON arena_batch_tasks(session_id);
`);

// Thin wrapper to provide better-sqlite3 compatible API on top of node:sqlite
const db = {
  prepare(sql: string) {
    const stmt = rawDb.prepare(sql);
    return {
      all(...params: any[]): any[] {
        return stmt.all(...params) as any[];
      },
      get(...params: any[]): any {
        return stmt.get(...params) as any;
      },
      run(...params: any[]): { changes: number; lastInsertRowid: number } {
        return stmt.run(...params) as any;
      }
    };
  },

  exec(sql: string) {
    rawDb.exec(sql);
  },

  pragma(str: string) {
    rawDb.exec(`PRAGMA ${str}`);
  },

  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]) => {
      rawDb.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT');
        return result;
      } catch (e) {
        rawDb.exec('ROLLBACK');
        throw e;
      }
    };
  }
};

export default db;
