// app/answers/[id]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';

interface Answer {
  id: number;
  question_id: number;
  model_id: number;
  content: string;
  created_at: string;
  question_content: string;
  model_name: string;
}

interface Score {
  id: number;
  answer_id: number;
  dimension_id: number;
  score: string;
  created_at: string;
  dimension_name: string;
  dimension_prompt: string;
}

interface ExtractedScore {
  dimensionId: number;
  dimensionName: string;
  scoreValue: number | null;
  rawScore: string;
}

export default function AnswerDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const answerId = Number(params.id);
  const router = useRouter();
  const { t, locale } = useTranslation();
  
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadAnswer();
  }, [answerId]);

  const loadAnswer = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/answers/${answerId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load answer');
      }
      
      const data = await response.json();
      
      if (data && data.answer) {
        setAnswer(data.answer);
        setScores(Array.isArray(data.scores) ? data.scores : []);
      } else {
        setAnswer(null);
        setScores([]);
      }
    } catch (error) {
      console.error('Failed to load answer:', error);
      setAnswer(null);
      setScores([]);
    } finally {
      setLoading(false);
    }
  };

  // 从评分文本中提取分数
  const extractScore = (scoreText: string): number | null => {
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

  // 处理所有评分，提取分数
  const extractedScores: ExtractedScore[] = Array.isArray(scores) ? scores.map(score => ({
    dimensionId: score.dimension_id,
    dimensionName: score.dimension_name,
    scoreValue: extractScore(score.score),
    rawScore: score.score,
  })) : [];

  // 计算平均分
  const validScores = extractedScores.filter(s => s.scoreValue !== null);
  const averageScore = validScores.length > 0
    ? validScores.reduce((sum, s) => sum + (s.scoreValue || 0), 0) / validScores.length
    : null;

  // 切换评分标准显示
  const togglePrompt = (dimensionId: number) => {
    setExpandedPrompts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dimensionId)) {
        newSet.delete(dimensionId);
      } else {
        newSet.add(dimensionId);
      }
      return newSet;
    });
  };

  // 展开所有
  const expandAll = () => {
    setExpandedPrompts(new Set(scores.map(s => s.dimension_id)));
  };

  // 收起所有
  const collapseAll = () => {
    setExpandedPrompts(new Set());
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!answer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-xl text-gray-600">{t('answers.notFound')}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
          >
            {t('common.backPrevious')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('common.backPrevious')}
          </button>

          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
            {t('answers.title', { id: answer.id })}
          </h1>
          <p className="text-gray-600">{t('answers.subtitle')}</p>
        </div>

        {/* 综合评分卡片 */}
        {averageScore !== null && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl shadow-lg border border-blue-100 p-8 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-700 mb-2">{t('answers.overallScore')}</p>
                <div className="flex items-baseline space-x-3">
                  <span className="text-6xl font-bold text-blue-900">{averageScore.toFixed(1)}</span>
                  <span className="text-2xl text-blue-600">{t('common.points')}</span>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-semibold text-purple-700 mb-2">{t('answers.scoreDimensions')}</p>
                <p className="text-4xl font-bold text-purple-900">{validScores.length}</p>
                <p className="text-sm text-purple-600 mt-1">{t('answers.dimensionCount')}</p>
              </div>
            </div>
          </div>
        )}

        {/* 各维度分数 - 统一配色 */}
        {extractedScores.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('answers.dimensionScores')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {extractedScores.map((extracted) => (
                <div
                  key={extracted.dimensionId}
                  className="bg-purple-50 border-2 border-purple-200 rounded-xl p-5 hover:shadow-md hover:border-purple-300 transition-all"
                >
                  <h3 className="font-bold text-gray-800 mb-3 text-sm">{extracted.dimensionName}</h3>
                  
                  {extracted.scoreValue !== null ? (
                    <div className="flex items-baseline space-x-2">
                      <span className="text-4xl font-bold text-purple-900">{extracted.scoreValue.toFixed(1)}</span>
                      <span className="text-lg text-purple-600">{t('common.points')}</span>
                    </div>
                  ) : (
                    <div className="py-2">
                      <p className="text-sm text-gray-500">{t('answers.noScoreDetected')}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Answer Info */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">{t('answers.basicInfo')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('answers.model')}</label>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4">
                <p className="font-bold text-lg text-purple-900">{answer.model_name}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{t('answers.createdAt')}</label>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="font-medium text-blue-900">
                  {new Date(answer.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('answers.question')}</label>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{answer.question_content}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('answers.answer')}</label>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{answer.content}</p>
            </div>
          </div>
        </div>

        {/* Scores */}
        {scores.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  {t('answers.scoreDetails')}
                  <span className="text-lg text-gray-600 ml-2">({t('answers.dimensionsCount', { count: scores.length })})</span>
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={expandAll}
                    className="px-4 py-2 text-sm bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-semibold transition-colors"
                  >
                    {t('answers.expandAll')}
                  </button>
                  <button
                    onClick={collapseAll}
                    className="px-4 py-2 text-sm bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-semibold transition-colors"
                  >
                    {t('answers.collapseAll')}
                  </button>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {extractedScores.map((extracted, index) => {
                const score = scores[index];
                const isExpanded = expandedPrompts.has(extracted.dimensionId);

                return (
                  <div key={score.id} className="p-6 hover:bg-gray-50 transition-colors">
                    {/* 维度标题和分数 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-800">{extracted.dimensionName}</h3>
                          {extracted.scoreValue !== null && (
                            <span className="px-4 py-1.5 bg-purple-100 border-2 border-purple-300 rounded-lg text-base font-bold text-purple-900">
                              {extracted.scoreValue.toFixed(1)} {t('common.points')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {t('answers.scoreTime')} {new Date(score.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                        </p>
                      </div>

                      <button
                        onClick={() => togglePrompt(extracted.dimensionId)}
                        className="ml-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-semibold transition-colors flex items-center space-x-2"
                      >
                        <span>{isExpanded ? t('answers.hideScoring') : t('answers.viewScoring')}</span>
                        <svg
                          className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* 评分标准（可折叠） */}
                    {isExpanded && (
                      <div className="mb-4 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-amber-800 mb-2">{t('answers.scoringCriteria')}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {score.dimension_prompt}
                        </p>
                      </div>
                    )}

                    {/* 评分结果 */}
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">{t('answers.scoreDetailLabel')}</p>
                      <div className="bg-white rounded-lg p-4 border border-purple-100">
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{extracted.rawScore}</p>
                      </div>
                      
                      {extracted.scoreValue === null && (
                        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-800">
                            {t('answers.noScoreExtracted')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-xl text-gray-600 mb-4">{t('answers.noScores')}</p>
            <p className="text-gray-500">{t('answers.noScoresDesc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
