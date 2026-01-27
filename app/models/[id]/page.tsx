// app/models/[id]/page.tsx
'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useTranslation } from '@/lib/i18n/context';

interface Answer {
  id: number;
  question_id: number;
  question_content: string;
  content: string;
  created_at: string;
}

interface ModelScoreData {
  total_score: number;
  dimensions: {
    [dimensionName: string]: number;
  };
}

interface Model {
  id: number;
  name: string;
  average_score: string | null; // 可能是 JSON 字符串、数字字符串或 null
}

export default function ModelDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const modelId = params.id;
  const { t, locale } = useTranslation();

  const [model, setModel] = useState<Model | null>(null);
  const [scoreData, setScoreData] = useState<ModelScoreData | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    loadData();
  }, [modelId, currentPage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelRes, answersRes, countRes] = await Promise.all([
        fetch(`/api/models/${modelId}`),
        fetch(`/api/answers?modelId=${modelId}&page=${currentPage}&limit=${itemsPerPage}`),
        fetch(`/api/answers/count?modelId=${modelId}`),
      ]);

      const modelData = await modelRes.json();
      const answersData = await answersRes.json();
      const countData = await countRes.json();

      setModel(modelData);
      
      // 解析评分数据
      if (modelData.average_score) {
        try {
          // 尝试解析为 JSON
          const parsed = JSON.parse(modelData.average_score);
          if (parsed && typeof parsed === 'object' && 'total_score' in parsed) {
            setScoreData(parsed);
          } else {
            setScoreData(null);
          }
        } catch {
          // 如果不是 JSON，可能是旧的数字格式，忽略
          setScoreData(null);
        }
      } else {
        setScoreData(null);
      }
      
      setAnswers(answersData);
      setTotalAnswers(countData.count);
      setTotalPages(Math.ceil(countData.count / itemsPerPage));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading && !model) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner size="lg" text={t('models.loadingData')} />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-xl text-gray-600">{t('models.notFound')}</p>
          <Link href="/" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
            {t('common.backHome')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4 transition-colors">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('common.backHome')}
          </Link>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {model.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-gray-800 mb-2">{model.name}</h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                      {t('common.ready')}
                    </span>
                    <span>•</span>
                    <span>{totalAnswers} {t('models.answers')}</span>
                    {scoreData && (
                      <>
                        <span>•</span>
                        <span className="flex items-center">
                          <span className="mr-1">⭐</span>
                          {t('models.totalScore')} <span className="font-bold text-purple-600 ml-1">{scoreData.total_score.toFixed(2)}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 模型评分卡片 */}
            {scoreData && (
              <div className="mt-6 space-y-4">
                {/* 总分卡片 */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-purple-700 mb-2">{t('models.modelTotalScore')}</p>
                      <div className="flex items-baseline space-x-3">
                        <span className="text-5xl font-bold text-purple-900">{scoreData.total_score.toFixed(2)}</span>
                        <span className="text-2xl text-purple-600">{t('common.points')}</span>
                      </div>
                      <p className="text-xs text-purple-600 mt-2">
                        {t('models.dimensionFormula')}
                      </p>
                    </div>
                    <div className="text-6xl">⭐</div>
                  </div>
                </div>

                {/* 各维度分数 */}
                <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">{t('models.dimensionScores')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(scoreData.dimensions).map(([dimensionName, score]) => (
                      <div
                        key={dimensionName}
                        className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200"
                      >
                        <p className="text-sm font-semibold text-blue-700 mb-2">{dimensionName}</p>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-3xl font-bold text-blue-900">{score.toFixed(2)}</span>
                          <span className="text-lg text-blue-600">{t('common.points')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Answers List */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-3">💬</span>
            {t('models.answerList')}
            {totalPages > 0 && (
              <span className="text-lg text-gray-500 ml-3">
                {t('models.pageInfo', { current: currentPage, total: totalPages, count: totalAnswers })}
              </span>
            )}
          </h2>

          {loading ? (
            <LoadingSpinner size="md" text={t('models.loadingAnswers')} />
          ) : answers.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-xl text-gray-500 mb-2">{t('models.noAnswers')}</p>
              <p className="text-gray-400">{t('models.noAnswersDesc')}</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {answers.map((answer, index) => (
                  <div
                    key={answer.id}
                    className="border-2 border-gray-100 hover:border-purple-200 rounded-xl p-6 transition-all duration-300 card-hover animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-700 mb-2 flex items-center">
                            <span className="mr-2">❓</span>
                            {answer.question_content}
                          </h3>
                          <div className="bg-gray-50 rounded-lg p-4 mb-3">
                            <p className="text-gray-800 leading-relaxed">
                              {truncateText(answer.content)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">
                              📅 {new Date(answer.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                            </span>
                            <a
                              href={`/answers/${answer.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold rounded-lg transition-colors"
                            >
                              {t('models.viewScoreDetails')}
                              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                  {/* 移动端分页信息 */}
                  <div className="sm:hidden text-sm text-gray-600">
                    {t('models.pageInfo', { current: currentPage, total: totalPages, count: totalAnswers })}
                  </div>

                  {/* 分页按钮 */}
                  <div className="flex items-center space-x-2">
                    {/* 首页按钮 */}
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
                      title="首页"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* 上一页按钮 */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
                    >
                      {t('common.prevPage')}
                    </button>

                    {/* 页码按钮 */}
                    <div className="hidden sm:flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-10 h-10 rounded-lg font-semibold transition-colors ${
                              currentPage === pageNum
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    {/* 下一页按钮 */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
                    >
                      {t('common.nextPage')}
                    </button>

                    {/* 尾页按钮 */}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
                      title="尾页"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* 跳转到指定页 */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{t('common.jumpTo')}</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        const page = parseInt(e.target.value);
                        if (page >= 1 && page <= totalPages) {
                          setCurrentPage(page);
                        }
                      }}
                      className="w-16 px-2 py-1 border-2 border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <span className="text-sm text-gray-600">{t('common.page')}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
