// app/arena/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';

interface Expert {
  id: number;
  expert_type: 'A' | 'B' | 'C';
  model_name: string;
  prompt: string;
}

interface Dimension {
  id: number;
  name: string;
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
  final_score: number;
  judgment_text: string;
}

type RoundViewers = Record<string, number>;

function ArenaPageContent() {
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();

  const [experts, setExperts] = useState<Expert[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [maxRounds, setMaxRounds] = useState(3);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [scores, setScores] = useState<Score[]>([]);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [loading, setLoading] = useState(false);
  const [roundViewers, setRoundViewers] = useState<RoundViewers>({});

  useEffect(() => {
    loadExperts();
    loadDimensions();
    
    // 检查是否有 sessionId 参数（继续会话）
    const continueSessionId = searchParams?.get('sessionId');
    if (continueSessionId) {
      loadExistingSession(Number(continueSessionId));
    }
  }, [searchParams]);

  const loadExperts = async () => {
    const res = await fetch('/api/arena/experts');
    const data = await res.json();
    setExperts(data);
  };

  const loadDimensions = async () => {
    const res = await fetch('/api/dimensions');
    const data = await res.json();
    setDimensions(data);
  };

  const loadExistingSession = async (sid: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/arena/sessions?sessionId=${sid}`);
      const data = await res.json();
      
      setSessionId(sid);
      setQuestion(data.session.question);
      setAnswer(data.session.answer);
      setMaxRounds(data.session.max_rounds);
      setCurrentRound(data.session.current_round);
      setScores(data.scores);
      setJudgments(data.judgments);
    } catch (error) {
      console.error('Failed to load session:', error);
      alert(t('arena.loadSessionFailed'));
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    if (!question.trim() || !answer.trim()) {
      alert(t('arena.pleaseEnterQA'));
      return;
    }

    setLoading(true);
    try {
      const expertA = experts.find(e => e.expert_type === 'A');
      const expertB = experts.find(e => e.expert_type === 'B');
      const expertC = experts.find(e => e.expert_type === 'C');

      const res = await fetch('/api/arena/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          answer,
          maxRounds,
          expertAId: expertA?.id,
          expertBId: expertB?.id,
          expertCId: expertC?.id,
        }),
      });

      const data = await res.json();
      setSessionId(data.sessionId);
      
      // 自动开始第一轮
      await executeBattle(data.sessionId, 1);
    } catch (error) {
      console.error('Failed to start session:', error);
      alert(t('arena.createSessionFailed'));
    } finally {
      setLoading(false);
    }
  };

  const executeBattle = async (sid: number, round: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/arena/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, roundNumber: round, locale }),
      });

      if (!res.ok) {
        throw new Error('Battle failed');
      }

      await loadSessionData(sid);
      setCurrentRound(round);
    } catch (error) {
      console.error('Battle failed:', error);
      alert(t('arena.battleFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadSessionData = async (sid: number) => {
    const res = await fetch(`/api/arena/sessions?sessionId=${sid}`);
    const data = await res.json();
    setScores(data.scores);
    setJudgments(data.judgments);
  };

  const executeJudgment = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const res = await fetch('/api/arena/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, locale }),
      });

      if (!res.ok) {
        throw new Error('Judgment failed');
      }

      await loadSessionData(sessionId);
    } catch (error) {
      console.error('Judgment failed:', error);
      alert(t('arena.judgmentFailed'));
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const data = {
      question,
      answer,
      maxRounds,
      currentRound,
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
    // 先检查是否有裁决
    const judgment = judgments.find(j => j.dimension_id === dimensionId);
    if (judgment) return judgment.final_score;

    // 检查从第1轮到当前轮，是否有任何一轮达成一致
    // 从最新轮次往前查找
    for (let round = currentRound; round >= 1; round--) {
      const roundScores = scores.filter(
        s => s.dimension_id === dimensionId && s.round_number === round
      );
      
      // 如果这一轮有评分且达成一致
      if (roundScores.length === 2 && roundScores[0].is_agreed === 1) {
        return roundScores[0].score_value;
      }
      
      // 如果这一轮有评分但不一致，说明还在交锋中
      if (roundScores.length === 2 && roundScores[0].is_agreed === 0) {
        return null;
      }
    }

    return null;
  };

  const hasDisagreements = (): boolean => {
    // 获取所有维度
    const allDimensionIds = dimensions.map(d => d.id);
    
    // 检查每个维度是否达成一致
    for (const dimensionId of allDimensionIds) {
      let isAgreed = false;
      
      // 从第1轮到当前轮，检查是否有任何一轮达成一致
      for (let round = 1; round <= currentRound; round++) {
        const roundScores = scores.filter(
          s => s.dimension_id === dimensionId && s.round_number === round
        );
        
        if (roundScores.length === 2 && roundScores[0].is_agreed === 1) {
          isAgreed = true;
          break;
        }
      }
      
      // 如果这个维度还没有达成一致，返回 true
      if (!isAgreed) {
        return true;
      }
    }
    
    return false;
  };

  const getDimensionStatus = (dimensionId: number) => {
    // 检查是否有裁决
    if (judgments.find(j => j.dimension_id === dimensionId)) {
      return { status: 'judged', text: t('arenaHistory.judged'), color: 'purple' };
    }
    
    // 从最新轮次往前查找
    for (let round = currentRound; round >= 1; round--) {
      const roundScores = scores.filter(
        s => s.dimension_id === dimensionId && s.round_number === round
      );
      
      if (roundScores.length === 2) {
        if (roundScores[0].is_agreed === 1) {
          return { status: 'agreed', text: t('arena.agreedAtRound', { round }), color: 'green' };
        } else if (round === currentRound) {
          return { status: 'disagreed', text: t('arena.disagreed'), color: 'red' };
        }
      }
    }
    
    return { status: 'pending', text: t('arena.pendingScore'), color: 'gray' };
  };

  const canContinue = currentRound < maxRounds && hasDisagreements();
  const canJudge = currentRound === maxRounds && hasDisagreements();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('common.backHome')}
            </Link>
            
            <Link 
              href="/arena/history"
              className="inline-flex items-center px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold rounded-lg transition-colors"
            >
              <span className="mr-2">📚</span>
              {t('arena.viewHistoryRecords')}
            </Link>
          </div>

          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
            {t('arena.title')}
          </h1>
          <p className="text-gray-600">{t('arena.subtitle')}</p>
        </div>

        {/* Expert Configuration */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">{t('arena.expertConfig')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['A', 'B', 'C'].map(type => {
              const expert = experts.find(e => e.expert_type === type);
              return (
                <div key={type} className={`border-2 rounded-xl p-4 ${
                  type === 'A' ? 'border-blue-300 bg-blue-50' :
                  type === 'B' ? 'border-green-300 bg-green-50' :
                  'border-purple-300 bg-purple-50'
                }`}>
                  <h3 className="font-bold text-lg mb-2">
                    {type === 'A' ? `🔵 ${t('arena.expertA')}` :
                     type === 'B' ? `🟢 ${t('arena.expertB')}` :
                     `🟣 ${t('arena.judgeC')}`}
                  </h3>
                  {expert && (
                    <>
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold">{t('arena.modelLabel')}</span> {expert.model_name}
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-3">
                        {expert.prompt}
                      </p>
                      <Link 
                        href="/arena/settings" 
                        className="text-xs text-blue-600 hover:text-blue-700 mt-2 inline-block"
                      >
                        {t('arena.modifyConfig')}
                      </Link>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        {!sessionId && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">{t('arena.quickActions')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/arena/history"
                className="bg-white rounded-xl p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-blue-300"
              >
                <div className="text-4xl mb-3">📚</div>
                <h3 className="font-bold text-lg mb-2">{t('arena.viewHistoryBtn')}</h3>
                <p className="text-sm text-gray-600">{t('arena.browseRecords')}</p>
              </Link>
              
              <Link
                href="/arena/settings"
                className="bg-white rounded-xl p-6 hover:shadow-lg transition-all border-2 border-transparent hover:border-purple-300"
              >
                <div className="text-4xl mb-3">⚙️</div>
                <h3 className="font-bold text-lg mb-2">{t('arena.expertConfig')}</h3>
                <p className="text-sm text-gray-600">{t('arena.modifyExpertPrompt')}</p>
              </Link>
              
              <div className="bg-white rounded-xl p-6 border-2 border-green-300">
                <div className="text-4xl mb-3">🚀</div>
                <h3 className="font-bold text-lg mb-2">{t('arena.newBattle')}</h3>
                <p className="text-sm text-gray-600">{t('arena.enterQABelow')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Input Section */}
        {!sessionId && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">{t('arena.newBattle')}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('arena.questionLabel')}</label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder={t('arena.questionPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('arena.answerLabel')}</label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={5}
                  placeholder={t('arena.answerPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t('arena.maxRounds')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxRounds}
                  onChange={(e) => setMaxRounds(Number(e.target.value))}
                  className="w-32 px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('arena.maxRoundsDesc', { rounds: maxRounds })}
                </p>
              </div>

              <button
                onClick={startSession}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? t('arena.creatingSession') : t('arena.startBattle')}
              </button>
            </div>
          </div>
        )}

        {/* Battle Results */}
        {sessionId && (
          <>
            {/* Progress Bar */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">{t('arena.progress')}</h2>
                <div className="text-sm text-gray-600">
                  {t('arena.round', { current: currentRound, max: maxRounds })}
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${(currentRound / maxRounds) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-center space-x-4">
                {canContinue && (
                  <button
                    onClick={() => executeBattle(sessionId, currentRound + 1)}
                    disabled={loading}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    {loading ? t('arena.battling') : t('arena.nextRound')}
                  </button>
                )}

                {canJudge && (
                  <button
                    onClick={executeJudgment}
                    disabled={loading}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    {loading ? t('arena.judging') : t('arena.finalJudgment')}
                  </button>
                )}

                <button
                  onClick={exportData}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all"
                >
                  {t('arena.exportData')}
                </button>

                <Link
                  href="/arena/history"
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition-all"
                >
                  {t('arena.viewHistoryBtn')}
                </Link>
              </div>
            </div>

            {/* Loading Indicator */}
            {loading && (
              <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
                <p className="text-gray-600 font-semibold">{t('arena.aiScoring')}</p>
              </div>
            )}

            {/* Dimension Results */}
            <div className="space-y-6">
              {dimensions.map((dimension) => {
                const scoresA = getScoresForDimension(dimension.id, 'A');
                const scoresB = getScoresForDimension(dimension.id, 'B');
                const finalScore = getFinalScore(dimension.id);
                const dimensionStatus = getDimensionStatus(dimension.id);
                
                const keyA = `${dimension.id}_A`;
                const keyB = `${dimension.id}_B`;
                const currentViewRoundA = roundViewers[keyA] || scoresA.length;
                const currentViewRoundB = roundViewers[keyB] || scoresB.length;

                return (
                  <div
                    key={dimension.id}
                    className="bg-white rounded-2xl shadow-xl overflow-hidden"
                  >
                    {/* Dimension Header */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 border-b-2 border-purple-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <h3 className="text-2xl font-bold text-gray-800">
                            {dimension.name}
                          </h3>
                          {/* 状态指示器 */}
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${
                            dimensionStatus.status === 'judged' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                            dimensionStatus.status === 'agreed' ? 'bg-green-100 text-green-700 border-green-300' :
                            dimensionStatus.status === 'disagreed' ? 'bg-red-100 text-red-700 border-red-300' :
                            'bg-gray-100 text-gray-700 border-gray-300'
                          }`}>
                            {dimensionStatus.text}
                          </span>
                        </div>
                        {finalScore !== null && (
                          <div className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-xl shadow-lg">
                            <div className="text-center">
                              <p className="text-xs font-semibold text-white mb-1">{t('arena.finalScore')}</p>
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
                          <h4 className="text-lg font-bold text-blue-700">{`🔵 ${t('arena.expertALabel')}`}</h4>
                          {scoresA.length > 1 && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setRoundViewers(prev => ({
                                  ...prev,
                                  [keyA]: Math.max(1, currentViewRoundA - 1)
                                }))}
                                disabled={currentViewRoundA === 1}
                                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50"
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
                                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded disabled:opacity-50"
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
                                {t('arena.roundLabel', { round: scoresA[currentViewRoundA - 1].round_number })}
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
                                  <p className="text-xs text-white">{t('arena.finalScore')}</p>
                                </div>
                              </div>
                              {judgments.find(j => j.dimension_id === dimension.id) ? (
                                <p className="text-sm text-purple-600 font-semibold">{t('arena.judgeDecision')}</p>
                              ) : (
                                <p className="text-sm text-green-600 font-semibold">{t('arena.expertAgreed')}</p>
                              )}
                            </>
                          ) : (
                            <div className="text-gray-400">
                              <div className="text-6xl mb-2">⚔️</div>
                              <p className="text-sm">{t('arena.battling')}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expert B */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-bold text-green-700">{`🟢 ${t('arena.expertBLabel')}`}</h4>
                          {scoresB.length > 1 && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setRoundViewers(prev => ({
                                  ...prev,
                                  [keyB]: Math.max(1, currentViewRoundB - 1)
                                }))}
                                disabled={currentViewRoundB === 1}
                                className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded disabled:opacity-50"
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
                                className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded disabled:opacity-50"
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
                                {t('arena.roundLabel', { round: scoresB[currentViewRoundB - 1].round_number })}
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
                        <h4 className="text-lg font-bold text-purple-700 mb-3">{`🟣 ${t('arena.judgeCLabel')} - ${t('arena.finalJudgment')}`}</h4>
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
          </>
        )}
      </div>
    </div>
  );
}

export default function ArenaPage() {
  const { t } = useTranslation();

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    }>
      <ArenaPageContent />
    </Suspense>
  );
}
