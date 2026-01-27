// lib/queries.ts
import db from './db';

// Question 操作
export const getQuestions = () => {
  return db.prepare('SELECT * FROM questions ORDER BY id DESC').all();
};

export const getQuestion = (id: number) => {
  return db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
};

export const createQuestion = (content: string) => {
  return db.prepare('INSERT INTO questions (content) VALUES (?)').run(content);
};

export const updateQuestion = (id: number, content: string) => {
  return db.prepare('UPDATE questions SET content = ? WHERE id = ?').run(content, id);
};

export const deleteQuestion = (id: number) => {
  return db.prepare('DELETE FROM questions WHERE id = ?').run(id);
};

// Model 操作
export const getModels = () => {
  return db.prepare('SELECT * FROM models ORDER BY id DESC').all();
};

export const getModel = (id: number) => {
  return db.prepare('SELECT * FROM models WHERE id = ?').get(id);
};

export const createModel = (name: string) => {
  return db.prepare('INSERT INTO models (name) VALUES (?)').run(name);
};

export const updateModel = (id: number, name: string) => {
  return db.prepare('UPDATE models SET name = ? WHERE id = ?').run(name, id);
};

export const updateModelScore = (id: number, scoreData: string) => {
  return db.prepare('UPDATE models SET average_score = ? WHERE id = ?').run(scoreData, id);
};

export const deleteModel = (id: number) => {
  return db.prepare('DELETE FROM models WHERE id = ?').run(id);
};

// Answer 操作
export const getAnswers = () => {
  return db.prepare(`
    SELECT a.*, q.content as question_content, m.name as model_name
    FROM answers a
    JOIN questions q ON a.question_id = q.id
    JOIN models m ON a.model_id = m.id
    ORDER BY a.created_at DESC
  `).all();
};

export const getAnswersByModel = (modelId: number) => {
  return db.prepare(`
    SELECT a.*, q.content as question_content
    FROM answers a
    JOIN questions q ON a.question_id = q.id
    WHERE a.model_id = ?
    ORDER BY a.created_at DESC
  `).all(modelId);
};

export const getAnswersByModelPaginated = (modelId: number, page: number = 1, limit: number = 10) => {
  const offset = (page - 1) * limit;
  return db.prepare(`
    SELECT a.*, q.content as question_content
    FROM answers a
    JOIN questions q ON a.question_id = q.id
    WHERE a.model_id = ?
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(modelId, limit, offset);
};

export const getAnswersCountByModel = (modelId: number): number => {
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM answers
    WHERE model_id = ?
  `).get(modelId) as { count: number };
  return result.count;
};

export const getAnswer = (id: number) => {
  return db.prepare(`
    SELECT a.*, q.content as question_content, m.name as model_name
    FROM answers a
    JOIN questions q ON a.question_id = q.id
    JOIN models m ON a.model_id = m.id
    WHERE a.id = ?
  `).get(id);
};

export const createAnswer = (questionId: number, modelId: number, content: string) => {
  return db.prepare('INSERT INTO answers (question_id, model_id, content) VALUES (?, ?, ?)').run(questionId, modelId, content);
};

export const deleteAnswer = (id: number) => {
  return db.prepare('DELETE FROM answers WHERE id = ?').run(id);
};

// Dimension 操作
export const getDimensions = () => {
  return db.prepare('SELECT * FROM dimensions ORDER BY id').all();
};

export const getDimension = (id: number) => {
  return db.prepare('SELECT * FROM dimensions WHERE id = ?').get(id);
};

export const createDimension = (name: string, prompt: string) => {
  return db.prepare('INSERT INTO dimensions (name, prompt) VALUES (?, ?)').run(name, prompt);
};

export const updateDimension = (id: number, name: string, prompt: string) => {
  return db.prepare('UPDATE dimensions SET name = ?, prompt = ? WHERE id = ?').run(name, prompt, id);
};

export const deleteDimension = (id: number) => {
  return db.prepare('DELETE FROM dimensions WHERE id = ?').run(id);
};

// Score 操作
export const getScores = () => {
  return db.prepare(`
    SELECT s.*, d.name as dimension_name, a.content as answer_content
    FROM scores s
    JOIN dimensions d ON s.dimension_id = d.id
    JOIN answers a ON s.answer_id = a.id
    ORDER BY s.created_at DESC
  `).all();
};

export const getScoresByAnswer = (answerId: number) => {
  return db.prepare(`
    SELECT s.*, d.name as dimension_name, d.prompt as dimension_prompt
    FROM scores s
    JOIN dimensions d ON s.dimension_id = d.id
    WHERE s.answer_id = ?
    ORDER BY d.id
  `).all(answerId);
};

export const createScore = (answerId: number, dimensionId: number, score: string) => {
  return db.prepare('INSERT INTO scores (answer_id, dimension_id, score) VALUES (?, ?, ?)').run(answerId, dimensionId, score);
};

export const deleteScore = (id: number) => {
  return db.prepare('DELETE FROM scores WHERE id = ?').run(id);
};

// 统计查询
export const getModelStats = (modelId: number) => {
  const answersCount = db.prepare('SELECT COUNT(*) as count FROM answers WHERE model_id = ?').get(modelId) as { count: number };
  const scoresCount = db.prepare(`
    SELECT COUNT(*) as count FROM scores s
    JOIN answers a ON s.answer_id = a.id
    WHERE a.model_id = ?
  `).get(modelId) as { count: number };

  return {
    answersCount: answersCount.count,
    scoresCount: scoresCount.count
  };
};

// 从评分文本中提取分数
export const extractScore = (scoreText: string): number | null => {
  if (!scoreText || typeof scoreText !== 'string') return null;

  // 1. 优先提取 XML 格式 <score>number</score>，取最后一个
  const xmlMatches = scoreText.match(/<score>(.*?)<\/score>/g);
  if (xmlMatches && xmlMatches.length > 0) {
    const lastMatch = xmlMatches[xmlMatches.length - 1];
    const numberMatch = lastMatch.match(/<score>(.*?)<\/score>/);
    if (numberMatch && numberMatch[1]) {
      const score = parseFloat(numberMatch[1]);
      if (!isNaN(score)) {
        return score;
      }
    }
  }

  // 2. 回退到之前的逻辑
  const patterns = [
    /评分[：:]\s*(\d+(?:\.\d+)?)/i,
    /得分[：:]\s*(\d+(?:\.\d+)?)/i,
    /分数[：:]\s*(\d+(?:\.\d+)?)/i,
    /score[：:]\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*分/,
    /(\d+(?:\.\d+)?)\s*\/\s*\d+/,
  ];

  for (const pattern of patterns) {
    const match = scoreText.match(pattern);
    if (match && match[1]) {
      const score = parseFloat(match[1]);
      if (!isNaN(score)) {
        return score;
      }
    }
  }

  const numberMatch = scoreText.match(/\b(\d+(?:\.\d+)?)\b/);
  if (numberMatch && numberMatch[1]) {
    const score = parseFloat(numberMatch[1]);
    if (!isNaN(score) && score >= 0 && score <= 100) {
      return score;
    }
  }

  return null;
};

// 计算模型的各维度评分和总分
export interface ModelScoreData {
  total_score: number;
  dimensions: {
    [dimensionName: string]: number;
  };
}

export const calculateModelScoreData = (modelId: number): ModelScoreData | null => {
  // 获取所有维度
  const dimensions = getDimensions() as Array<{ id: number; name: string }>;
  
  if (dimensions.length === 0) return null;

  // 获取该模型所有答案的所有评分
  const scores = db.prepare(`
    SELECT s.score, d.name as dimension_name
    FROM scores s
    JOIN answers a ON s.answer_id = a.id
    JOIN dimensions d ON s.dimension_id = d.id
    WHERE a.model_id = ?
  `).all(modelId) as Array<{ score: string; dimension_name: string }>;

  if (scores.length === 0) return null;

  // 按维度分组并计算平均分
  const dimensionScores: { [key: string]: number[] } = {};
  
  for (const scoreRecord of scores) {
    const score = extractScore(scoreRecord.score);
    if (score !== null) {
      if (!dimensionScores[scoreRecord.dimension_name]) {
        dimensionScores[scoreRecord.dimension_name] = [];
      }
      dimensionScores[scoreRecord.dimension_name].push(score);
    }
  }

  // 计算每个维度的平均分
  const dimensionAverages: { [key: string]: number } = {};
  const validDimensionScores: number[] = [];

  for (const [dimensionName, scores] of Object.entries(dimensionScores)) {
    if (scores.length > 0) {
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      dimensionAverages[dimensionName] = parseFloat(avg.toFixed(2));
      validDimensionScores.push(avg);
    }
  }

  if (validDimensionScores.length === 0) return null;

  // 计算总分：所有维度平均分的平均值 * 14
  const overallAverage = validDimensionScores.reduce((sum, s) => sum + s, 0) / validDimensionScores.length;
  const totalScore = parseFloat((overallAverage * 14).toFixed(2));

  return {
    total_score: totalScore,
    dimensions: dimensionAverages
  };
};
