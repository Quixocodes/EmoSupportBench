// app/arena/view/[id]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Session {
  id: number;
  question: string;
  answer: string;
  max_rounds: number;
  current_round: number;
  status: string;
  expert_a_model: string;
  expert_a_prompt: string;
  expert_b_model: string;
  expert_b_prompt: string;
  expert_c_model: string;
  expert_c_prompt: string;
  created_at: string;
  completed_at: string | null;
}

interface Score {
  dimension_id: number;
  dimension_name: string;
  round_number: number;
  expert_type: 'A' | 'B' | 'C';
  score_value: number | null;
  score_text: string;
  is_agreed: number;
}

interface Judgment {
  dimension_id: number;
  dimension_name: string;
  final_score: number;
  judgment_text: string;
}

interface Dimension {
  id: number;
  name: string;
}

export default function ArenaViewPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const sessionId = Number(params.id);
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [roundViewers, setRoundViewers] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionRes, dimensionsRes] = await Promise.all([
        fetch(`/api/arena/sessions?sessionId=${sessionId}`),
        fetch('/api/dimensions')
      ]);

      const sessionData = await sessionRes.json();
      const dimensionsData = await dimensionsRes.json();

      setSession(sessionData.session);
      setScores(sessionData.scores);
      setJudgments(sessionData.judgments);
      setDimensions(dimensionsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const data = {
      session,
      scores,
      judgments,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arena_session_${sessionId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getScoresForDimension = (dimensionId: number, expertType: 'A' | 'B'): Score[] => {
    return scores
      .filter(s => s.dimension_id === dimensionId && s.expert_type === expertType)
      .sort((a, b) => a.round_number - b.round_number);
  };

  const getFinalScore = (dimensionId: number): number | null => {
    const judgment = judgments.find(j => j.dimension_id === dimensionId);
    if (judgment) return judgment.final_score;

    if (!session) return null;

    for (let round = session.current_round; round >= 1; round--) {
      const roundScores = scores.filter(
        s => s.dimension_id === dimensionId && s.round_number === round
      );
      
      if (roundScores.length === 2 && roundScores[0].is_agreed === 1) {
        return roundScores[0].score_value;
      }
      
      if (roundScores.length === 2 && roundScores[0].is_agreed === 0) {
        return null;
      }
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-xl text-gray-600">会话不存在</p>
          <Link href="/arena/history" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
            返回历史记录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/arena/history" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回历史记录
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
                交锋会话 #{session.id}
              </h1>
              <p className="text-gray-600">
                创建于 {new Date(session.created_at).toLocaleString('zh-CN')}
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {session.status === 'in_progress' && (
                <button
                  onClick={() => router.push(`/arena?sessionId=${sessionId}`)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
                >
                  ▶️ 继续交锋
                </button>
              )}
              <button
                onClick={exportData}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
              >
                📥 导出数据
              </button>
            </div>
          </div>
        </div>

        {/* Session Info */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">会话信息</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-700 mb-2">❓ 问题</p>
              <p className="text-gray-800 whitespace-pre-wrap">{session.question}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-700 mb-2">💬 回答</p>
              <p className="text-gray-800 whitespace-pre-wrap">{session.answer}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-700 mb-2">🔵 专家A</p>
              <p className="text-xs text-gray-600 mb-1">模型: {session.expert_a_model}</p>
              <p className="text-xs text-gray-600 line-clamp-2">{session.expert_a_prompt}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-700 mb-2">🟢 专家B</p>
              <p className="text-xs text-gray-600 mb-1">模型: {session.expert_b_model}</p>
              <p className="text-xs text-gray-600 line-clamp-2">{session.expert_b_prompt}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-purple-700 mb-2">🟣 裁判C</p>
              <p className="text-xs text-gray-600 mb-1">模型: {session.expert_c_model}</p>
              <p className="text-xs text-gray-600 line-clamp-2">{session.expert_c_prompt}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">状态:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                session.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                session.status === 'completed' ? 'bg-green-100 text-green-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {session.status === 'in_progress' ? '进行中' :
                 session.status === 'completed' ? '已完成' : '已裁决'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">轮次:</span>
              <span className="font-bold text-gray-800">
                第 {session.current_round} / {session.max_rounds} 轮
              </span>
            </div>
            {session.completed_at && (
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">完成时间:</span>
                <span className="text-gray-800">
                  {new Date(session.completed_at).toLocaleString('zh-CN')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Dimension Results */}
        <div className="space-y-6">
          {dimensions.map((dimension) => {
            const scoresA = getScoresForDimension(dimension.id, 'A');
            const scoresB = getScoresForDimension(dimension.id, 'B');
            const finalScore = getFinalScore(dimension.id);
            
            const keyA = `${dimension.id}_A`;
            const keyB = `${dimension.id}_B`;
            const currentViewRoundA = roundViewers[keyA] || scoresA.length;
            const currentViewRoundB = roundViewers[keyB] || scoresB.length;

            // 如果这个维度没有评分，跳过
            if (scoresA.length === 0 && scoresB.length === 0) return null;

            return (
              <div
                key={dimension.id}
                className="bg-white rounded-2xl shadow-xl overflow-hidden"
              >
                {/* Dimension Header */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 border-b-2 border-purple-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-gray-800">
                      {dimension.name}
                    </h3>
                    {finalScore !== null && (
                      <div className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-xl shadow-lg">
                        <div className="text-center">
                          <p className="text-xs font-semibold text-white mb-1">最终分数</p>
                          <p className="text-3xl font-bold text-white">{finalScore.toFixed(1)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Battle Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                  {/* Expert A */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-bold text-blue-700">🔵 专家A</h4>
                      {scoresA.length > 1 && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setRoundViewers(prev => ({
                              ...prev,
                              [keyA]: Math.max(1, currentViewRoundA - 1)
                            }))}
                            disabled={currentViewRoundA === 1}
                            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50 text-sm"
                          >
                            ←
                          </button>
                          <span className="text-sm text-gray-600">
                            {currentViewRoundA}/{scoresA.length}
                          </span>
                          <button
                            onClick={() => setRoundViewers(prev => ({
                              ...prev,
                              [keyA]: Math.min(scoresA.length, currentViewRoundA + 1)
                            }))}
                            disabled={currentViewRoundA === scoresA.length}
                            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50 text-sm"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </div>

                    {scoresA[currentViewRoundA - 1] && (
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-blue-700">
                            第 {scoresA[currentViewRoundA - 1].round_number} 轮
                          </span>
                          {scoresA[currentViewRoundA - 1].score_value !== null && (
                            <span className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold">
                              {scoresA[currentViewRoundA - 1].score_value?.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {scoresA[currentViewRoundA - 1].score_text}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Center - Final Score */}
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      {finalScore !== null ? (
                        <>
                          <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-2xl mb-4">
                            <div>
                              <p className="text-4xl font-bold text-white">
                                {finalScore.toFixed(1)}
                              </p>
                              <p className="text-xs text-white">最终分数</p>
                            </div>
                          </div>
                          {judgments.find(j => j.dimension_id === dimension.id) ? (
                            <p className="text-sm text-purple-600 font-semibold">⚖️ 裁判裁决</p>
                          ) : (
                            <p className="text-sm text-green-600 font-semibold">✅ 专家一致</p>
                          )}
                        </>
                      ) : (
                        <div className="text-gray-400">
                          <div className="text-6xl mb-2">⚔️</div>
                          <p className="text-sm">未达成一致</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expert B */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-bold text-green-700">🟢 专家B</h4>
                      {scoresB.length > 1 && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setRoundViewers(prev => ({
                              ...prev,
                              [keyB]: Math.max(1, currentViewRoundB - 1)
                            }))}
                            disabled={currentViewRoundB === 1}
                            className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded disabled:opacity-50 text-sm"
                          >
                            ←
                          </button>
                          <span className="text-sm text-gray-600">
                            {currentViewRoundB}/{scoresB.length}
                          </span>
                          <button
                            onClick={() => setRoundViewers(prev => ({
                              ...prev,
                              [keyB]: Math.min(scoresB.length, currentViewRoundB + 1)
                            }))}
                            disabled={currentViewRoundB === scoresB.length}
                            className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded disabled:opacity-50 text-sm"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </div>

                    {scoresB[currentViewRoundB - 1] && (
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-green-700">
                            第 {scoresB[currentViewRoundB - 1].round_number} 轮
                          </span>
                          {scoresB[currentViewRoundB - 1].score_value !== null && (
                            <span className="px-3 py-1 bg-green-600 text-white rounded-lg font-bold">
                              {scoresB[currentViewRoundB - 1].score_value?.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {scoresB[currentViewRoundB - 1].score_text}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Judge Decision (if exists) */}
                {judgments.find(j => j.dimension_id === dimension.id) && (
                  <div className="bg-purple-50 border-t-2 border-purple-200 p-6">
                    <h4 className="text-lg font-bold text-purple-700 mb-3">🟣 裁判C的最终裁决</h4>
                    <div className="bg-white border-2 border-purple-300 rounded-xl p-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {judgments.find(j => j.dimension_id === dimension.id)?.judgment_text}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

