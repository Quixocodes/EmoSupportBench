'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';

interface InferenceQueue {
  id: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  current_task: string | null;
  error_message: string | null;
  max_concurrency: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  isRunning: boolean;
  isPaused: boolean;
}

interface Question {
  id: number;
  content: string;
}

interface Model {
  id: number;
  name: string;
}

export default function InferenceTasksPage() {
  const { t, locale } = useTranslation();
  const [queues, setQueues] = useState<InferenceQueue[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // 创建队列的表单状态
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [selectedModels, setSelectedModels] = useState<number[]>([]);
  const [maxConcurrency, setMaxConcurrency] = useState(3);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadQueues();
    loadQuestions();
    loadModels();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadQueues();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadQueues = async () => {
    try {
      const response = await fetch('/api/inference-queue');
      const data = await response.json();
      setQueues(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load queues:', error);
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const response = await fetch('/api/questions');
      const data = await response.json();
      setQuestions(data);
    } catch (error) {
      console.error('Failed to load questions:', error);
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

  const createQueue = async () => {
    try {
      const response = await fetch('/api/inference-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds: selectedQuestions,
          modelIds: selectedModels,
          maxConcurrency,
        }),
      });

      const data = await response.json();
      alert(data.message);
      
      setShowCreateForm(false);
      setSelectedQuestions([]);
      setSelectedModels([]);
      setMaxConcurrency(3);
      
      await loadQueues();
    } catch (error) {
      console.error('Failed to create queue:', error);
      alert(t('admin.inference.createFailed'));
    }
  };

  const deleteQueue = async (queueId: number) => {
    if (!confirm(t('admin.inference.confirmDelete'))) return;

    try {
      await fetch(`/api/inference-queue?id=${queueId}`, {
        method: 'DELETE',
      });
      await loadQueues();
    } catch (error) {
      console.error('Failed to delete queue:', error);
    }
  };

  const toggleQuestionSelection = (questionId: number) => {
    setSelectedQuestions(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const toggleModelSelection = (modelId: number) => {
    setSelectedModels(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const selectAllQuestions = () => {
    setSelectedQuestions(questions.map(q => q.id));
  };

  const deselectAllQuestions = () => {
    setSelectedQuestions([]);
  };

  const selectAllModels = () => {
    setSelectedModels(models.map(m => m.id));
  };

  const deselectAllModels = () => {
    setSelectedModels([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'running': return 'bg-blue-100 text-blue-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': t('admin.inference.statusPending'),
      'running': t('admin.inference.statusRunning'),
      'paused': t('admin.inference.statusPaused'),
      'completed': t('admin.inference.statusCompleted'),
      'failed': t('admin.inference.statusFailed'),
      'cancelled': t('admin.inference.statusCancelled')
    };
    return statusMap[status] || status;
  };

  const getStatusIcon = (status: string) => {
    const iconMap: Record<string, string> = {
      'pending': '⏳',
      'running': '🔄',
      'paused': '⏸️',
      'completed': '✅',
      'failed': '❌',
      'cancelled': '⛔'
    };
    return iconMap[status] || '❓';
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-4">
            {t('admin.inference.title')}
          </h1>
          <p className="text-gray-600 text-lg">
            {t('admin.inference.subtitle')}
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold shadow-lg transition-all transform hover:scale-105"
              >
                {t('admin.inference.createTask')}
              </button>
              
              <button
                onClick={loadQueues}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
              >
                {t('common.refresh')}
              </button>
            </div>

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

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4">{t('admin.inference.createTitle')}</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 选择问题 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{t('admin.inference.selectQuestions')}</h3>
                  <div className="space-x-2">
                    <button
                      onClick={selectAllQuestions}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {t('common.selectAll')}
                    </button>
                    <button
                      onClick={deselectAllQuestions}
                      className="text-sm text-gray-600 hover:text-gray-700"
                    >
                      {t('common.clear')}
                    </button>
                  </div>
                </div>
                <div className="border-2 border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                  {questions.map(question => (
                    <label
                      key={question.id}
                      className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(question.id)}
                        onChange={() => toggleQuestionSelection(question.id)}
                        className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="flex-1 text-sm">{question.content}</span>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {t('admin.inference.selectedCount', { count: selectedQuestions.length, total: questions.length })}
                </p>
              </div>

              {/* 选择模型 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg">{t('admin.inference.selectModels')}</h3>
                  <div className="space-x-2">
                    <button
                      onClick={selectAllModels}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      {t('common.selectAll')}
                    </button>
                    <button
                      onClick={deselectAllModels}
                      className="text-sm text-gray-600 hover:text-gray-700"
                    >
                      {t('common.clear')}
                    </button>
                  </div>
                </div>
                <div className="border-2 border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto space-y-2">
                  {models.map(model => (
                    <label
                      key={model.id}
                      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(model.id)}
                        onChange={() => toggleModelSelection(model.id)}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="flex-1 font-medium">{model.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {t('admin.inference.selectedCount', { count: selectedModels.length, total: models.length })}
                </p>
              </div>
            </div>

            {/* 并发数设置 */}
            <div className="mb-6">
              <label className="block font-semibold mb-2">{t('admin.inference.maxConcurrency')}</label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                className="w-32 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-600 mt-1">
                {t('admin.inference.concurrencyRange')}
              </p>
            </div>

            {/* 任务统计 */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6">
              <p className="text-lg font-semibold text-gray-800">
                {t('admin.inference.taskCount', { questions: selectedQuestions.length, models: selectedModels.length, total: selectedQuestions.length * selectedModels.length })}
              </p>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={createQueue}
                disabled={selectedQuestions.length === 0 || selectedModels.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('admin.inference.createAndStart')}
              </button>
            </div>
          </div>
        )}

        {/* Queues List */}
        <div className="space-y-4">
          {queues.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl text-gray-500 mb-4">{t('admin.inference.noQueues')}</p>
              <p className="text-gray-400">{t('admin.inference.noQueuesDesc')}</p>
            </div>
          ) : (
            queues.map(queue => {
              const progress = queue.total_tasks > 0
                ? ((queue.completed_tasks + queue.failed_tasks) / queue.total_tasks) * 100
                : 0;

              return (
                <div key={queue.id} className="bg-white rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-2xl font-bold text-gray-800">
                          {t('admin.inference.queueTitle', { id: queue.id })}
                        </h3>
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getStatusColor(queue.status)}`}>
                          {getStatusIcon(queue.status)} {getStatusText(queue.status)}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>{t('admin.inference.createdAt')} {new Date(queue.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</p>
                        {queue.started_at && (
                          <p>{t('admin.inference.startedAt')} {new Date(queue.started_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</p>
                        )}
                        {queue.completed_at && (
                          <p>{t('admin.inference.completedAt')} {new Date(queue.completed_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</p>
                        )}
                        <p>{t('admin.inference.concurrency')} {queue.max_concurrency}</p>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                    <Link
                        href={`/admin/tasks/inference/${queue.id}`}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                        {t('admin.inference.viewDetails')}
                    </Link>
                    
                    {['completed', 'failed', 'cancelled'].includes(queue.status) && (
                        <button
                        onClick={() => deleteQueue(queue.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                        >
                        {t('common.delete')}
                        </button>
                    )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-semibold mb-1">{t('admin.inference.totalTasks')}</p>
                      <p className="text-2xl font-bold text-blue-900">{queue.total_tasks}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 font-semibold mb-1">{t('admin.inference.completedTasks')}</p>
                      <p className="text-2xl font-bold text-green-900">{queue.completed_tasks}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs text-red-600 font-semibold mb-1">{t('admin.inference.failedTasks')}</p>
                      <p className="text-2xl font-bold text-red-900">{queue.failed_tasks}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-xs text-purple-600 font-semibold mb-1">{t('admin.inference.progressLabel')}</p>
                      <p className="text-2xl font-bold text-purple-900">{Math.round(progress)}%</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
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

                  {/* Current Task */}
                  {queue.current_task && (
                    <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">{t('admin.inference.currentTask')}</p>
                      <p className="text-sm text-blue-900 flex items-center">
                        <span className="animate-pulse mr-2">🔄</span>
                        {queue.current_task}
                      </p>
                    </div>
                  )}

                  {/* Error Message */}
                  {queue.error_message && (
                    <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-700 mb-1">{t('admin.inference.errorMessage')}</p>
                      <p className="text-sm text-red-900">{queue.error_message}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
