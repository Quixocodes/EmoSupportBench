// app/admin/arena-batch/page.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';

interface Expert {
  id: number;
  expert_type: 'A' | 'B' | 'C';
  model_name: string;
}

interface Question {
  id: number;
  content: string;
}

interface Model {
  id: number;
  name: string;
}

interface Answer {
  id: number;
  question_id: number;
  model_id: number;
  question_content: string;
  model_name: string;
  content: string;
}

interface Queue {
  id: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  current_task: string | null;
  max_concurrency: number;
  max_rounds: number;
  created_at: string;
}

export default function ArenaBatchPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // 添加一个 ref 来跟踪是否正在加载，防止并发请求
  const loadingRef = useRef(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [selectedModels, setSelectedModels] = useState<number[]>([]);
  const [expertAId, setExpertAId] = useState<number>(0);
  const [expertBId, setExpertBId] = useState<number>(0);
  const [expertCId, setExpertCId] = useState<number>(0);
  const [maxConcurrency, setMaxConcurrency] = useState(2);
  const [maxRounds, setMaxRounds] = useState(3);

  // 根据选择的问题和模型，计算匹配的答案
  const selectedAnswers = useMemo(() => {
    if (selectedQuestions.length === 0 || selectedModels.length === 0) {
      return [];
    }
    return answers
      .filter(a => selectedQuestions.includes(a.question_id) && selectedModels.includes(a.model_id))
      .map(a => a.id);
  }, [answers, selectedQuestions, selectedModels]);

  useEffect(() => {
    loadData();
  }, []);

	useEffect(() => {
	  if (!autoRefresh) return;
	  
	  // 增加初始延迟，避免与初始加载冲突
	  const initialDelay = setTimeout(() => {
		const interval = setInterval(() => {
		  loadData();
		}, 10000); // 改为10秒
		
		return () => clearInterval(interval);
	  }, 10000); // 改为10秒
	  
	  return () => {
		clearTimeout(initialDelay);
	  };
	}, [autoRefresh]);


  const loadData = async () => {
    // 使用 ref 防止并发请求
    if (loadingRef.current) {
      console.log('Previous request still in progress, skipping...');
      return;
    }
    
    loadingRef.current = true;
    
    try {
      const [queuesRes, expertsRes, questionsRes, modelsRes, answersRes] = await Promise.all([
        fetch('/api/arena-batch-queue'),
        fetch('/api/arena/experts'),
        fetch('/api/questions'),
        fetch('/api/models'),
        fetch('/api/answers')
      ]);

      const [queuesData, expertsData, questionsData, modelsData, answersData] = await Promise.all([
        queuesRes.json(),
        expertsRes.json(),
        questionsRes.json(),
        modelsRes.json(),
        answersRes.json()
      ]);

      setQueues(queuesData);
      setExperts(expertsData);
      setQuestions(questionsData);
      setModels(modelsData);
      setAnswers(answersData);

      if (expertsData.length >= 3 && expertAId === 0) {
        const expA = expertsData.find((e: Expert) => e.expert_type === 'A');
        const expB = expertsData.find((e: Expert) => e.expert_type === 'B');
        const expC = expertsData.find((e: Expert) => e.expert_type === 'C');
        if (expA) setExpertAId(expA.id);
        if (expB) setExpertBId(expB.id);
        if (expC) setExpertCId(expC.id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      loadingRef.current = false;
    }
  };

  const createQueue = async () => {
    if (selectedAnswers.length === 0) {
      alert(t('admin.arenaBatch.noAnswersMatch'));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/arena-batch-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxConcurrency,
          maxRounds,
          expertAId,
          expertBId,
          expertCId,
          answerIds: selectedAnswers
        })
      });

      const data = await response.json();
      alert(data.message);

      setShowCreateForm(false);
      setSelectedQuestions([]);
      setSelectedModels([]);
      await loadData();
    } catch (error) {
      alert(t('admin.arenaBatch.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 计算每个问题有多少个匹配的答案
  const getQuestionAnswerCount = (questionId: number) => {
    if (selectedModels.length === 0) {
      return answers.filter(a => a.question_id === questionId).length;
    }
    return answers.filter(a => a.question_id === questionId && selectedModels.includes(a.model_id)).length;
  };

  // 计算每个模型有多少个匹配的答案
  const getModelAnswerCount = (modelId: number) => {
    if (selectedQuestions.length === 0) {
      return answers.filter(a => a.model_id === modelId).length;
    }
    return answers.filter(a => a.model_id === modelId && selectedQuestions.includes(a.question_id)).length;
  };

  const deleteQueue = async (queueId: number) => {
    if (!confirm(t('admin.arenaBatch.confirmDelete'))) return;

    try {
      await fetch(`/api/arena-batch-queue/${queueId}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      alert(t('admin.arenaBatch.deleteFailed'));
    }
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('common.backHome')}
          </Link>

          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
            {t('admin.arenaBatch.title')}
          </h1>
          <p className="text-gray-600">{t('admin.arenaBatch.subtitle')}</p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-6 py-3 bg-gradient-primary text-white font-bold rounded-xl hover:shadow-lg transition-all"
              >
                {t('admin.arenaBatch.createTask')}
              </button>
              <button
                onClick={loadData}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
              >
                {t('common.refresh')}
              </button>
            </div>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-5 h-5 text-purple-600 rounded"
              />
              <span className="text-sm font-medium">{t('common.autoRefresh')}</span>
            </label>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-2xl font-bold mb-6">{t('admin.arenaBatch.createTitle')}</h2>

            {/* 专家配置 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2">{t('admin.arenaBatch.expertAStrict')}</label>
                <select
                  value={expertAId}
                  onChange={(e) => setExpertAId(Number(e.target.value))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl"
                >
                  {experts.filter(e => e.expert_type === 'A').map(e => (
                    <option key={e.id} value={e.id}>{e.model_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('admin.arenaBatch.expertBLenient')}</label>
                <select
                  value={expertBId}
                  onChange={(e) => setExpertBId(Number(e.target.value))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl"
                >
                  {experts.filter(e => e.expert_type === 'B').map(e => (
                    <option key={e.id} value={e.id}>{e.model_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('admin.arenaBatch.judgeCFair')}</label>
                <select
                  value={expertCId}
                  onChange={(e) => setExpertCId(Number(e.target.value))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl"
                >
                  {experts.filter(e => e.expert_type === 'C').map(e => (
                    <option key={e.id} value={e.id}>{e.model_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 参数设置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2">{t('admin.arenaBatch.maxConcurrency')}</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={maxConcurrency}
                  onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('admin.arenaBatch.maxRounds')}</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxRounds}
                  onChange={(e) => setMaxRounds(Number(e.target.value))}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl"
                />
              </div>
            </div>

            {/* 问题选择 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">{t('admin.arenaBatch.selectQuestions')}</h3>
                <div className="space-x-2">
                  <button
                    onClick={() => setSelectedQuestions(questions.map(q => q.id))}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {t('common.selectAll')}
                  </button>
                  <button
                    onClick={() => setSelectedQuestions([])}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    {t('common.clear')}
                  </button>
                </div>
              </div>
              <div className="border-2 border-gray-200 rounded-xl p-4 max-h-64 overflow-y-auto space-y-2">
                {questions.map(question => {
                  const answerCount = getQuestionAnswerCount(question.id);
                  return (
                    <label
                      key={question.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer ${answerCount === 0 ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(question.id)}
                        onChange={() => {
                          setSelectedQuestions(prev =>
                            prev.includes(question.id)
                              ? prev.filter(id => id !== question.id)
                              : [...prev, question.id]
                          );
                        }}
                        className="mt-1 w-5 h-5 text-purple-600 rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm line-clamp-2">{question.content}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {t('admin.arenaBatch.matchingAnswers', { count: answerCount })}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {t('admin.arenaBatch.selectedQuestionsCount', { count: selectedQuestions.length, total: questions.length })}
              </p>
            </div>

            {/* 模型选择 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">{t('admin.arenaBatch.selectModels')}</h3>
                <div className="space-x-2">
                  <button
                    onClick={() => setSelectedModels(models.map(m => m.id))}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {t('common.selectAll')}
                  </button>
                  <button
                    onClick={() => setSelectedModels([])}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    {t('common.clear')}
                  </button>
                </div>
              </div>
              <div className="border-2 border-gray-200 rounded-xl p-4 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {models.map(model => {
                    const answerCount = getModelAnswerCount(model.id);
                    return (
                      <label
                        key={model.id}
                        className={`flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border ${
                          selectedModels.includes(model.id) ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                        } ${answerCount === 0 ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(model.id)}
                          onChange={() => {
                            setSelectedModels(prev =>
                              prev.includes(model.id)
                                ? prev.filter(id => id !== model.id)
                                : [...prev, model.id]
                            );
                          }}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{model.name}</p>
                          <p className="text-xs text-gray-500">{t('admin.arenaBatch.matchingCount', { count: answerCount })}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {t('admin.arenaBatch.selectedModelsCount', { count: selectedModels.length, total: models.length })}
              </p>
            </div>

            {/* 匹配结果统计 */}
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-purple-800">{t('admin.arenaBatch.matchResult')}</h3>
                  <p className="text-sm text-purple-600">
                    {t('admin.arenaBatch.questionsAndModels', { questions: selectedQuestions.length, models: selectedModels.length })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-purple-700">{selectedAnswers.length}</p>
                  <p className="text-sm text-purple-600">{t('admin.arenaBatch.answersToScore')}</p>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={createQueue}
                disabled={loading || selectedAnswers.length === 0}
                className="px-6 py-3 bg-gradient-primary text-white font-bold rounded-xl disabled:opacity-50"
              >
                {loading ? t('common.creating') : t('admin.arenaBatch.createAndStart')}
              </button>
            </div>
          </div>
        )}

        {/* Queues List */}
        <div className="space-y-4">
          {queues.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl p-16 text-center">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl text-gray-500">{t('admin.arenaBatch.noQueues')}</p>
            </div>
          ) : (
            queues.map(queue => {
              const progress = queue.total_tasks > 0
                ? ((queue.completed_tasks + queue.failed_tasks) / queue.total_tasks) * 100
                : 0;

              return (
                <div key={queue.id} className="bg-white rounded-2xl shadow-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-2xl font-bold">{t('admin.arenaBatch.queueTitle', { id: queue.id })}</h3>
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getStatusColor(queue.status)}`}>
                          {queue.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {t('admin.arenaBatch.createdAt')} {new Date(queue.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}
                      </p>
                    </div>

                    <div className="flex space-x-2">
                      <Link
                        href={`/admin/arena-batch/${queue.id}`}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                      >
                        {t('admin.arenaBatch.viewDetails')}
                      </Link>
                      {['completed', 'failed', 'cancelled'].includes(queue.status) && (
                        <button
                          onClick={() => deleteQueue(queue.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
                        >
                          {t('common.delete')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-600 mb-1">{t('admin.arenaBatch.totalTasks')}</p>
                      <p className="text-2xl font-bold text-blue-900">{queue.total_tasks}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-600 mb-1">{t('admin.arenaBatch.completedTasks')}</p>
                      <p className="text-2xl font-bold text-green-900">{queue.completed_tasks}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-600 mb-1">{t('admin.arenaBatch.failedTasks')}</p>
                      <p className="text-2xl font-bold text-red-900">{queue.failed_tasks}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-purple-600 mb-1">{t('admin.arenaBatch.progressLabel')}</p>
                      <p className="text-2xl font-bold text-purple-900">{Math.round(progress)}%</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-full bg-gradient-primary rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {queue.current_task && (
                    <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-700">{t('admin.arenaBatch.currentTask')}</p>
                      <p className="text-sm text-blue-900">{queue.current_task}</p>
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
