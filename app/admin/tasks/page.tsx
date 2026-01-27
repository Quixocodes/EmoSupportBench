// app/admin/tasks/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';

interface TaskQueue {
  id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  current_task: string | null;
  error_message: string | null;
  max_concurrency: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  isRunning?: boolean;
}

interface Model {
  id: number;
  name: string;
}

interface Question {
  id: number;
  content: string;
}

export default function AdminTasksPage() {
  const { t, locale } = useTranslation();
  const [queues, setQueues] = useState<TaskQueue[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [creating, setCreating] = useState(false);
  const [maxConcurrency, setMaxConcurrency] = useState(3);
  const [selectedModels, setSelectedModels] = useState<number[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]); // 新增
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [cleanEmpty, setCleanEmpty] = useState(true);
  const [overwriteMode, setOverwriteMode] = useState(false); // 新增
  const [emptyScoresCount, setEmptyScoresCount] = useState(0);
  const [calculatingScores, setCalculatingScores] = useState(false);

  useEffect(() => {
    loadData();
    loadModels();
    loadQuestions(); // 新增
    loadEmptyScoresCount();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
      loadEmptyScoresCount();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadData = async () => {
    try {
      const response = await fetch('/api/task-queue');
      const data = await response.json();
      setQueues(data);
    } catch (error) {
      console.error('Failed to load queues:', error);
    }
  };

  const loadModels = async () => {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  // 新增：加载问题列表
  const loadQuestions = async () => {
    try {
      const response = await fetch('/api/questions');
      const data = await response.json();
      setQuestions(data);
    } catch (error) {
      console.error('Failed to load questions:', error);
    }
  };

  const loadEmptyScoresCount = async () => {
    try {
      const response = await fetch('/api/task-queue/empty-scores');
      const data = await response.json();
      setEmptyScoresCount(data.count);
    } catch (error) {
      console.error('Failed to load empty scores count:', error);
    }
  };

  const createQueue = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/task-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxConcurrency,
          modelIds: selectedModels,
          questionIds: selectedQuestions, // 新增
          cleanEmpty: cleanEmpty && !overwriteMode, // 覆盖模式下不清理
          overwriteMode, // 新增
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        await loadData();
        await loadEmptyScoresCount();
        setSelectedModels([]);
        setSelectedQuestions([]); // 新增
      }
    } catch (error) {
      console.error('Failed to create queue:', error);
      alert(t('admin.tasks.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (queueId: number, action: string) => {
    try {
      await fetch(`/api/task-queue/${queueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await loadData();
    } catch (error) {
      console.error(`Failed to ${action} queue:`, error);
    }
  };

  const deleteQueue = async (queueId: number) => {
    if (!confirm(t('admin.tasks.confirmDeleteQueue'))) return;

    try {
      await fetch(`/api/task-queue/${queueId}`, {
        method: 'DELETE',
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete queue:', error);
    }
  };

  const calculateAllScores = async () => {
    if (!confirm(t('admin.tasks.confirmCalculate'))) return;

    setCalculatingScores(true);
    try {
      const response = await fetch('/api/models/calculate-scores', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        await loadModels();
      } else {
        alert(t('admin.tasks.calculateFailed'));
      }
    } catch (error) {
      console.error('Failed to calculate scores:', error);
      alert(t('admin.tasks.calculateFailed'));
    } finally {
      setCalculatingScores(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'running': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return t('admin.tasks.statusPending');
      case 'running': return t('admin.tasks.statusRunning');
      case 'completed': return t('admin.tasks.statusCompleted');
      case 'failed': return t('admin.tasks.statusFailed');
      case 'cancelled': return t('admin.tasks.statusCancelled');
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '⛔';
      default: return '❓';
    }
  };

  const toggleModelSelection = (modelId: number) => {
    setSelectedModels(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const selectAllModels = () => {
    if (selectedModels.length === models.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(models.map(m => m.id));
    }
  };

  // 新增：问题选择功能
  const toggleQuestionSelection = (questionId: number) => {
    setSelectedQuestions(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const selectAllQuestions = () => {
    if (selectedQuestions.length === questions.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(questions.map(q => q.id));
    }
  };

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

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
                {t('admin.tasks.title')}
              </h1>
              <p className="text-gray-600">{t('admin.tasks.subtitle')}</p>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={calculateAllScores}
                disabled={calculatingScores}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {calculatingScores ? (
                  <span className="flex items-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('admin.tasks.calculating')}
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span className="mr-2">📊</span>
                    {t('admin.tasks.calculateAllScores')}
                  </span>
                )}
              </button>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700">{t('common.autoRefresh')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Create Queue Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
            <span className="mr-3">🚀</span>
            {t('admin.tasks.createTitle')}
          </h2>

          {/* 空评分提示 */}
          {emptyScoresCount > 0 && !overwriteMode && (
            <div className="mb-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">⚠️</div>
                <div className="flex-1">
                  <p className="font-semibold text-yellow-800">
                    {t('admin.tasks.emptyScoresWarning', { count: emptyScoresCount })}
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {t('admin.tasks.emptyScoresDesc')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* 并发设置 */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
              <label className="block text-sm font-semibold text-purple-700 mb-3">
                {t('admin.tasks.maxConcurrency')}
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg font-bold text-center"
              />
              <p className="text-xs text-purple-600 mt-2">
                {t('admin.tasks.concurrencyDesc')}
              </p>
            </div>

            {/* 模型选择 */}
            <div className="lg:col-span-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-blue-700">
                  {t('admin.tasks.selectModels')}
                </label>
                <button
                  onClick={selectAllModels}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedModels.length === models.length ? t('common.deselectAll') : t('common.selectAll')}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-40 overflow-y-auto">
                {models.map(model => (
                  <label
                    key={model.id}
                    className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedModels.includes(model.id)
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 hover:bg-blue-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={() => toggleModelSelection(model.id)}
                      className="hidden"
                    />
                    <span className="text-sm font-medium truncate">{model.name}</span>
                  </label>
                ))}
              </div>

              {models.length === 0 && (
                <p className="text-sm text-blue-600 text-center py-4">
                  {t('admin.tasks.noModelsMsg')}
                </p>
              )}

              <p className="text-xs text-blue-600 mt-3">
                {selectedModels.length > 0
                  ? t('admin.tasks.selectedModelsCount', { count: selectedModels.length })
                  : t('admin.tasks.allModelsDefault')}
              </p>
            </div>
          </div>

          {/* 新增：问题选择 */}
          <div className="mb-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-green-700">
                {t('admin.tasks.selectQuestions')}
              </label>
              <button
                onClick={selectAllQuestions}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                {selectedQuestions.length === questions.length ? t('common.deselectAll') : t('common.selectAll')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {questions.map(question => (
                <label
                  key={question.id}
                  className={`flex items-start space-x-2 p-3 rounded-lg cursor-pointer transition-all ${
                    selectedQuestions.includes(question.id)
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-green-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedQuestions.includes(question.id)}
                    onChange={() => toggleQuestionSelection(question.id)}
                    className="mt-1 flex-shrink-0"
                    style={{ accentColor: selectedQuestions.includes(question.id) ? 'white' : undefined }}
                  />
                  <span className="text-sm line-clamp-2">{question.content}</span>
                </label>
              ))}
            </div>

            {questions.length === 0 && (
              <p className="text-sm text-green-600 text-center py-4">
                {t('admin.tasks.noQuestionsMsg')}
              </p>
            )}

            <p className="text-xs text-green-600 mt-3">
              {selectedQuestions.length > 0
                ? t('admin.tasks.selectedQuestionsCount', { count: selectedQuestions.length })
                : t('admin.tasks.allQuestionsDefault')}
            </p>
          </div>

          {/* 新增：覆盖模式选项 */}
          <div className="mb-6 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-6">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={overwriteMode}
                onChange={(e) => {
                  setOverwriteMode(e.target.checked);
                  if (e.target.checked) {
                    setCleanEmpty(false); // 覆盖模式下禁用清理空评分
                  }
                }}
                className="mt-1 w-5 h-5 text-pink-600 rounded focus:ring-2 focus:ring-pink-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-sm font-semibold text-pink-700">{t('admin.tasks.overwriteMode')}</span>
                  <span className="px-2 py-0.5 bg-pink-200 text-pink-800 text-xs font-bold rounded">{t('admin.tasks.overwriteNew')}</span>
                </div>
                <p className="text-xs text-pink-600 mt-1">
                  {t('admin.tasks.overwriteDesc')}
                </p>
                <p className="text-xs text-pink-500 mt-1">
                  {t('admin.tasks.overwriteWarning')}
                </p>
              </div>
            </label>
          </div>

          {/* 清理空评分选项（只在非覆盖模式下显示） */}
          {!overwriteMode && (
            <div className="mb-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanEmpty}
                  onChange={(e) => setCleanEmpty(e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-orange-700">
                    {t('admin.tasks.cleanEmptyMode')}
                  </span>
                  <p className="text-xs text-orange-600 mt-1">
                    {t('admin.tasks.cleanEmptyDesc')}
                  </p>
                </div>
              </label>
            </div>
          )}

          <button
            onClick={createQueue}
            disabled={creating || models.length === 0}
            className="w-full py-4 bg-gradient-primary text-white font-bold text-lg rounded-xl hover:shadow-lg transition-all duration-300 btn-shine disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('common.creating')}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <span className="mr-2">🚀</span>
                {overwriteMode ? t('admin.tasks.createOverwrite') : t('admin.tasks.createIncremental')}
                {!overwriteMode && emptyScoresCount > 0 && cleanEmpty && (
                  <span className="ml-2 text-sm opacity-90">
                    {t('admin.tasks.willReScore', { count: emptyScoresCount })}
                  </span>
                )}
              </span>
            )}
          </button>
        </div>

        {/* Queues List */}
        <div className="space-y-6">
          {queues.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl text-gray-500 mb-2">{t('admin.tasks.noQueues')}</p>
              <p className="text-gray-400">{t('admin.tasks.noQueuesDesc')}</p>
            </div>
          ) : (
            queues.map((queue, index) => {
              const progress = queue.total_tasks > 0
                ? ((queue.completed_tasks + queue.failed_tasks) / queue.total_tasks) * 100
                : 0;

              return (
                <div
                  key={queue.id}
                  className="bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="p-8">
                    {/* Queue Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-start space-x-4">
                        <div className="text-5xl">
                          {getStatusIcon(queue.status)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-2xl font-bold text-gray-800">
                              {t('admin.tasks.queueTitle', { id: queue.id })}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(queue.status)}`}>
                              {getStatusText(queue.status)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>📅 {new Date(queue.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                            <span>•</span>
                            <span>🔢 {t('admin.tasks.concurrency')} {queue.max_concurrency}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        {queue.status === 'running' && (
                          <button
                            onClick={() => handleAction(queue.id, 'cancel')}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                        )}

                        {queue.status === 'failed' && (
                          <button
                            onClick={() => handleAction(queue.id, 'retry')}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                          >
                            {t('common.retry')}
                          </button>
                        )}

                        {queue.status === 'pending' && (
                          <button
                            onClick={() => handleAction(queue.id, 'resume')}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                          >
                            {t('common.start')}
                          </button>
                        )}

                        {['completed', 'cancelled', 'failed'].includes(queue.status) && (
                          <button
                            onClick={() => deleteQueue(queue.id)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                          >
                            {t('common.delete')}
                          </button>
                        )}

                        <Link
                          href={`/admin/tasks/${queue.id}`}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                        >
                          {t('common.details')}
                        </Link>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                        <p className="text-sm font-semibold text-blue-600 mb-1">{t('admin.tasks.totalTasks')}</p>
                        <p className="text-2xl font-bold text-blue-900">{queue.total_tasks}</p>
                      </div>

                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                        <p className="text-sm font-semibold text-green-600 mb-1">{t('admin.tasks.completedTasks')}</p>
                        <p className="text-2xl font-bold text-green-900">{queue.completed_tasks}</p>
                      </div>

                      <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4">
                        <p className="text-sm font-semibold text-red-600 mb-1">{t('admin.tasks.failedTasks')}</p>
                        <p className="text-2xl font-bold text-red-900">{queue.failed_tasks}</p>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                        <p className="text-sm font-semibold text-purple-600 mb-1">{t('admin.tasks.progressLabel')}</p>
                        <p className="text-2xl font-bold text-purple-900">{Math.round(progress)}%</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {queue.total_tasks > 0 && (
                      <div className="mb-6">
                        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
                          <div className="h-full flex">
                            <div
                              className="bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                              style={{ width: `${(queue.completed_tasks / queue.total_tasks) * 100}%` }}
                            ></div>
                            <div
                              className="bg-gradient-to-r from-red-400 to-red-600 transition-all duration-500"
                              style={{ width: `${(queue.failed_tasks / queue.total_tasks) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                          <span>{t('admin.tasks.completedTasks')}: {queue.completed_tasks}</span>
                          <span>{t('admin.tasks.failedTasks')}: {queue.failed_tasks}</span>
                          <span>{t('admin.tasks.remaining')} {queue.total_tasks - queue.completed_tasks - queue.failed_tasks}</span>
                        </div>
                      </div>
                    )}

                    {/* Current Task */}
                    {queue.current_task && queue.status === 'running' && (
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-blue-700 mb-1">{t('admin.tasks.currentTask')}</p>
                        <p className="text-blue-900 flex items-center">
                          <span className="animate-pulse mr-2">🔄</span>
                          {queue.current_task}
                        </p>
                      </div>
                    )}

                    {/* Error Message */}
                    {queue.error_message && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mt-4">
                        <p className="text-sm font-semibold text-red-700 mb-1">{t('admin.tasks.errorMessage')}</p>
                        <p className="text-red-900">{queue.error_message}</p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        {queue.started_at && (
                          <span>
                            {t('admin.tasks.startTime')} {new Date(queue.started_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                          </span>
                        )}
                        {queue.completed_at && (
                          <>
                            <span>•</span>
                            <span>
                              {t('admin.tasks.completeTime')} {new Date(queue.completed_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
