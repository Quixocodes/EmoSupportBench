// app/arena/history/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';

interface Session {
  id: number;
  question: string;
  answer: string;
  max_rounds: number;
  current_round: number;
  status: 'in_progress' | 'completed' | 'judged';
  expert_a_model: string;
  expert_b_model: string;
  expert_c_model: string;
  created_at: string;
  completed_at: string | null;
  total_scores: number;
  agreed_dimensions: number;
  judged_dimensions: number;
}

interface SessionListResponse {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ArenaHistoryPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'judged'>('all');

  useEffect(() => {
    loadSessions();
  }, [currentPage]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/arena/sessions/list?page=${currentPage}&limit=20`);
      const data: SessionListResponse = await res.json();
      setSessions(data.sessions);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: number) => {
    if (!confirm(t('arenaHistory.confirmDelete'))) return;

    try {
      await fetch(`/api/arena/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      await loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert(t('arenaHistory.deleteFailed'));
    }
  };

  const viewSession = (sessionId: number) => {
    router.push(`/arena/view/${sessionId}`);
  };

  const continueSession = (sessionId: number) => {
    router.push(`/arena?sessionId=${sessionId}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{t('arenaHistory.inProgress')}</span>;
      case 'completed':
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">{t('arenaHistory.completed')}</span>;
      case 'judged':
        return <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">{t('arenaHistory.judged')}</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // 过滤会话
  const filteredSessions = sessions.filter(session => {
    if (statusFilter !== 'all' && session.status !== statusFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        session.question.toLowerCase().includes(search) ||
        session.answer.toLowerCase().includes(search) ||
        session.expert_a_model.toLowerCase().includes(search) ||
        session.expert_b_model.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // 统计信息
  const stats = {
    total: sessions.length,
    in_progress: sessions.filter(s => s.status === 'in_progress').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    judged: sessions.filter(s => s.status === 'judged').length,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/arena" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('common.backArena')}
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
                {t('arenaHistory.title')}
              </h1>
              <p className="text-gray-600">{t('arenaHistory.subtitle')}</p>
            </div>

            <Link
              href="/arena"
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
            >
              {t('arenaHistory.startNewBattle')}
            </Link>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <p className="text-sm font-semibold text-gray-600 mb-1">{t('arenaHistory.totalSessions')}</p>
            <p className="text-3xl font-bold text-blue-600">{total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <p className="text-sm font-semibold text-gray-600 mb-1">{t('arenaHistory.inProgress')}</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.in_progress}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <p className="text-sm font-semibold text-gray-600 mb-1">{t('arenaHistory.completed')}</p>
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <p className="text-sm font-semibold text-gray-600 mb-1">{t('arenaHistory.judged')}</p>
            <p className="text-3xl font-bold text-purple-600">{stats.judged}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Status Filter */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'in_progress', 'completed', 'judged'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    statusFilter === status
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? t('arenaHistory.all') :
                   status === 'in_progress' ? t('arenaHistory.inProgress') :
                   status === 'completed' ? t('arenaHistory.completed') : t('arenaHistory.judged')}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder={t('arenaHistory.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Sessions List */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
            <p className="text-gray-600">{t('common.loading')}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl text-gray-600 mb-4">{t('arenaHistory.noRecords')}</p>
            <Link
              href="/arena"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors"
            >
              {t('arenaHistory.startFirst')}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map((session, index) => (
              <div
                key={session.id}
                className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        #{session.id}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          {getStatusBadge(session.status)}
                          <span className="text-xs text-gray-500">
                            {new Date(session.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {t('arena.round', { current: session.current_round, max: session.max_rounds })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => viewSession(session.id)}
                        className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold rounded-lg transition-colors"
                      >
                        {t('arenaHistory.view')}
                      </button>
                      {session.status === 'in_progress' && (
                        <button
                          onClick={() => continueSession(session.id)}
                          className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 font-semibold rounded-lg transition-colors"
                        >
                          {t('arenaHistory.continue')}
                        </button>
                      )}
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-blue-700 mb-2">{t('arena.questionLabel')}</p>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {truncateText(session.question, 150)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-green-700 mb-2">{t('arena.answerLabel')}</p>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {truncateText(session.answer, 150)}
                      </p>
                    </div>
                  </div>

                  {/* Models */}
                  <div className="flex items-center space-x-4 text-xs text-gray-600 mb-4">
                    <div className="flex items-center space-x-1">
                      <span className="font-semibold">{`🔵 ${t('arena.expertALabel')}:`}</span>
                      <span className="font-mono">{session.expert_a_model}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="font-semibold">{`🟢 ${t('arena.expertBLabel')}:`}</span>
                      <span className="font-mono">{session.expert_b_model}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="font-semibold">{`🟣 ${t('arena.judgeCLabel')}:`}</span>
                      <span className="font-mono">{session.expert_c_model}</span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">{t('arenaHistory.scoreCount')}:</span>
                      <span className="font-bold text-gray-800">{session.total_scores}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">{t('arenaHistory.agreedDimensions')}:</span>
                      <span className="font-bold text-green-600">{session.agreed_dimensions}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">{t('arenaHistory.judgedDimensions')}:</span>
                      <span className="font-bold text-purple-600">{session.judged_dimensions}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center space-x-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
            >
              {t('common.prevPage')}
            </button>

            <div className="flex items-center space-x-1">
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

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
            >
              {t('common.nextPage')}
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
            >
              »»
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
