'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';

interface DimensionScore {
  dimension_name: string;
  dimension_prompt: string;
  score: string;
}

const dimensionColors = [
  { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-700', accent: 'bg-purple-500', lightAccent: 'bg-purple-100', icon: '🎯' },
  { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700', accent: 'bg-blue-500', lightAccent: 'bg-blue-100', icon: '📋' },
  { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', accent: 'bg-green-500', lightAccent: 'bg-green-100', icon: '💡' },
  { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-700', accent: 'bg-orange-500', lightAccent: 'bg-orange-100', icon: '🔧' },
  { bg: 'bg-pink-50', border: 'border-pink-500', text: 'text-pink-700', accent: 'bg-pink-500', lightAccent: 'bg-pink-100', icon: '✨' },
];

export default function ExpertPage() {
  const { t, locale } = useTranslation();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [scores, setScores] = useState<DimensionScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalDimensions, setTotalDimensions] = useState(0);
  const [completedDimensions, setCompletedDimensions] = useState(0);
  const [dimensionStatuses, setDimensionStatuses] = useState<Record<string, 'pending' | 'loading' | 'completed'>>({});
  const [expandedPrompts, setExpandedPrompts] = useState<Record<number, boolean>>({});

  const togglePrompt = (index: number) => {
    setExpandedPrompts(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleScore = async () => {
    if (!question.trim() || !answer.trim()) {
      alert(t('expert.enterQA'));
      return;
    }

    setLoading(true);
    setScores([]);
    setProgress(0);
    setCompletedDimensions(0);
    setExpandedPrompts({});

    try {
      // 首先获取所有维度
      const dimensionsRes = await fetch('/api/dimensions');
      const dimensions = await dimensionsRes.json();
      setTotalDimensions(dimensions.length);

      // 初始化所有维度状态为 pending
      const initialStatuses: Record<string, 'pending' | 'loading' | 'completed'> = {};
      dimensions.forEach((dim: any) => {
        initialStatuses[dim.name] = 'pending';
      });
      setDimensionStatuses(initialStatuses);

      // 创建所有评分任务并并发执行
      const scoringPromises = dimensions.map(async (dimension: any, index: number) => {
        // 更新状态为 loading
        setDimensionStatuses(prev => ({
          ...prev,
          [dimension.name]: 'loading'
        }));

        try {
          const response = await fetch('/api/expert-score-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question,
              answer,
              dimensionName: dimension.name,
              dimensionPrompt: dimension.prompt,
              locale,
            }),
          });

          if (!response.ok) {
            throw new Error(t('expert.dimensionFailed', { name: dimension.name }));
          }

          const data = await response.json();
          const newScore = {
            dimension_name: dimension.name,
            dimension_prompt: dimension.prompt,
            score: data.score,
          };

          // 更新状态为 completed
          setDimensionStatuses(prev => ({
            ...prev,
            [dimension.name]: 'completed'
          }));

          // 更新完成数量
          setCompletedDimensions(prev => {
            const newCompleted = prev + 1;
            setProgress((newCompleted / dimensions.length) * 100);
            return newCompleted;
          });

          return { success: true, score: newScore, index };
        } catch (error) {
          console.error(`维度 ${dimension.name} 评分失败:`, error);
          return { success: false, error, index };
        }
      });

      // 等待所有评分完成
      const results = await Promise.allSettled(scoringPromises);

      // 收集成功的评分结果并按原始顺序排序
      const successfulScores = results
        .map((result, index) => {
          if (result.status === 'fulfilled' && result.value.success) {
            return { ...result.value.score, originalIndex: result.value.index };
          }
          return null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.originalIndex - b.originalIndex)
        .map((item: any) => {
          const { originalIndex, ...score } = item;
          return score;
        });

      setScores(successfulScores as DimensionScore[]);

      // 检查是否有失败的评分
      const failedCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
      if (failedCount > 0) {
        alert(t('expert.partialFailed', { failed: failedCount, total: dimensions.length }));
      }

    } catch (error) {
      console.error('Failed to score:', error);
      alert(t('expert.scoreFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {`← ${t('common.backHome')}`}
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              {t('expert.title')}
            </h1>
            <p className="text-xl text-gray-600">{t('expert.subtitle')}</p>
          </div>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-2xl mr-3">
                ❓
              </div>
              <h2 className="text-2xl font-bold text-gray-800">{t('expert.inputQuestion')}</h2>
            </div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={6}
              placeholder={t('expert.questionPlaceholder')}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-2xl mr-3">
                💬
              </div>
              <h2 className="text-2xl font-bold text-gray-800">{t('expert.inputAnswer')}</h2>
            </div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={6}
              placeholder={t('expert.answerPlaceholder')}
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center mb-8">
          <button
            onClick={handleScore}
            disabled={loading}
            className="px-12 py-4 bg-gradient-primary text-white font-bold text-lg rounded-2xl hover:shadow-2xl transition-all duration-300 btn-shine disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('expert.scoring')}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <span className="mr-2">⭐</span>
                {t('expert.startScoring')}
              </span>
            )}
          </button>
        </div>

        {/* Progress Section */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8 animate-fade-in">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4 animate-pulse-slow">⚡</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{t('expert.scoringInProgress')}</h3>
              <p className="text-gray-600">
                {t('expert.completedCount', { completed: completedDimensions, total: totalDimensions })}
              </p>
            </div>

            {/* 进度条 */}
            <div className="space-y-3 mb-6">
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full transition-all duration-300 ease-out flex items-center justify-end"
                  style={{ width: `${progress}%` }}
                >
                  {progress > 10 && (
                    <span className="text-xs font-bold text-white mr-2">
                      {Math.round(progress)}%
                    </span>
                  )}
                </div>
              </div>

              {/* 进度指示器 */}
              <div className="flex justify-between items-center text-sm text-gray-600">
                <span>{t('expert.completedDimensions', { count: completedDimensions })}</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>

            {/* 维度状态网格 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {Object.entries(dimensionStatuses).map(([name, status], index) => (
                <div
                  key={name}
                  className={`p-4 rounded-xl transition-all duration-300 ${
                    status === 'completed'
                      ? 'bg-green-100 border-2 border-green-500'
                      : status === 'loading'
                      ? 'bg-purple-100 border-2 border-purple-500 animate-pulse'
                      : 'bg-gray-100 border-2 border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mb-2 transition-all duration-300 ${
                        status === 'completed'
                          ? 'bg-green-500 text-white'
                          : status === 'loading'
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      {status === 'completed' ? '✓' : status === 'loading' ? (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : '...'}
                    </div>
                    <span className={`text-xs font-semibold truncate w-full ${
                      status === 'completed'
                        ? 'text-green-700'
                        : status === 'loading'
                        ? 'text-purple-700'
                        : 'text-gray-600'
                    }`}>
                      {name}
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      {status === 'completed' ? t('expert.completed') : status === 'loading' ? t('expert.inScoring') : t('expert.waiting')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Section */}
        {scores.length > 0 && (
          <div className="animate-fade-in">
            {/* 完成标题 */}
            {!loading && (
              <div className="text-center mb-8 bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 rounded-2xl p-8 shadow-xl">
                <div className="text-7xl mb-4 animate-bounce">🎉</div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-3">
                  {t('expert.scoringComplete')}
                </h2>
                <p className="text-xl text-gray-600">
                  {t('expert.expertCompleted', { count: scores.length })}
                </p>
              </div>
            )}

            {/* 评分卡片 */}
            <div className="space-y-6">
              {scores.map((score, index) => {
                const colorScheme = dimensionColors[index % dimensionColors.length];
                const isExpanded = expandedPrompts[index];
                
                return (
                  <div
                    key={index}
                    className={`relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 animate-fade-in border-l-8 ${colorScheme.border}`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {/* 装饰性背景 */}
                    <div className={`absolute top-0 right-0 w-64 h-64 ${colorScheme.bg} opacity-30 rounded-full -mr-32 -mt-32`}></div>
                    
                    <div className="relative p-8">
                      {/* 标题区域 */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center space-x-4">
                          <div className={`w-16 h-16 ${colorScheme.accent} rounded-2xl flex items-center justify-center text-3xl shadow-lg transform hover:scale-110 transition-transform`}>
                            {colorScheme.icon}
                          </div>
                          <div>
                            <h3 className={`text-3xl font-bold ${colorScheme.text} mb-1`}>
                              {score.dimension_name}
                            </h3>
                            <button
                              onClick={() => togglePrompt(index)}
                              className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1 transition-colors"
                            >
                              <span>{isExpanded ? t('expert.hideScoring') : t('expert.viewScoring')}</span>
                              <svg
                                className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        {dimensionStatuses[score.dimension_name] === 'completed' && (
                          <div className={`${colorScheme.lightAccent} ${colorScheme.text} px-4 py-2 rounded-full text-sm font-bold flex items-center space-x-2 shadow-sm`}>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>{t('expert.completed')}</span>
                          </div>
                        )}
                      </div>

                      {/* 评分标准（可折叠） */}
                      {isExpanded && (
                        <div className={`mb-6 ${colorScheme.bg} rounded-xl p-5 border-2 ${colorScheme.border} border-opacity-20 animate-fade-in`}>
                          <div className="flex items-center mb-3">
                            <div className={`w-8 h-8 ${colorScheme.lightAccent} rounded-lg flex items-center justify-center mr-3`}>
                              <span className="text-lg">📋</span>
                            </div>
                            <h4 className="font-semibold text-gray-700">{t('expert.scoringCriteria')}</h4>
                          </div>
                          <p className="text-gray-700 leading-relaxed pl-11">
                            {score.dimension_prompt}
                          </p>
                        </div>
                      )}

                      {/* 评分内容 */}
                      <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 shadow-inner border-2 border-gray-100">
                        <div className="flex items-center mb-5">
                          <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mr-3 shadow-md">
                            <span className="text-2xl">⭐</span>
                          </div>
                          <h4 className="text-xl font-semibold text-gray-800">{t('expert.expertScore')}</h4>
                        </div>
                        
                        <div className="prose prose-lg max-w-none">
                          <div className="text-gray-700 leading-normal text-base space-y-2">
                            {score.score.split('\n').map((paragraph, pIndex) => {
                              if (!paragraph.trim()) return null;
                              
                              return (
                                <p key={pIndex} className="text-gray-700">
                                  {paragraph}
                                </p>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 操作按钮 */}
            {!loading && (
              <div className="mt-12 text-center space-y-4">
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => {
                      const allExpanded = scores.every((_, index) => expandedPrompts[index]);
                      const newState: Record<number, boolean> = {};
                      scores.forEach((_, index) => {
                        newState[index] = !allExpanded;
                      });
                      setExpandedPrompts(newState);
                    }}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <span>
                      {scores.every((_, index) => expandedPrompts[index]) ? t('common.collapseAll') : t('common.expandAll')}
                    </span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setQuestion('');
                      setAnswer('');
                      setScores([]);
                      setProgress(0);
                      setCompletedDimensions(0);
                      setTotalDimensions(0);
                      setDimensionStatuses({});
                      setExpandedPrompts({});
                    }}
                    className="px-8 py-3 bg-gradient-primary text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 btn-shine flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{t('expert.reScore')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
