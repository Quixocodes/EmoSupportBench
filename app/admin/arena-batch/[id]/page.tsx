// app/admin/arena-batch/[id]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

interface Task {
  id: number;
  question_id: number;
  answer_id: number;
  session_id: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_round: number;
  is_agreed: number;
  needs_judgment: number;
  error_message: string | null;
  question_content: string;
  answer_content: string;
  model_name: string;
  created_at: string;
  completed_at: string | null;
}

interface QueueDetail {
  id: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  current_task: string | null;
  error_message: string | null;
  max_concurrency: number;
  max_rounds: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  isRunning: boolean;
  isPaused: boolean;
  tasks: Task[];
}

export default function ArenaBatchDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const queueId = Number(params.id);

  const [queue, setQueue] = useState<QueueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadQueue();
  }, [queueId]);

  useEffect(() => {
    if (!autoRefresh || !queue || queue.status === 'completed') return;
    const interval = setInterval(() => loadQueue(true), 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, queue?.status]);

  const loadQueue = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(`/api/arena-batch-queue/${queueId}`);
      const data = await response.json();
      setQueue(data);
      if (!silent) setLoading(false);
    } catch (error) {
      console.error('Failed to load queue:', error);
      if (!silent) setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    try {
      await fetch(`/api/arena-batch-queue/${queueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await loadQueue();
    } catch (error) {
      console.error(`Failed to ${action} queue:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'running': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'completed': return 'bg-green-100 text-green-700 border-green-300';
      case 'failed': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '...';
      case 'running': return '...';
      case 'completed': return 'OK';
      case 'failed': return 'X';
      default: return '?';
    }
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

  if (!queue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">X</div>
          <p className="text-xl text-gray-600">队列不存在</p>
          <Link href="/admin/arena-batch" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const progress = queue.total_tasks > 0
    ? ((queue.completed_tasks + queue.failed_tasks) / queue.total_tasks) * 100
    : 0;

  const filteredTasks = queue.tasks.filter(task => {
    if (filter !== 'all' && task.status !== filter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        task.model_name.toLowerCase().includes(search) ||
        task.question_content.toLowerCase().includes(search) ||
        task.answer_content.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const stats = queue.tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/arena-batch" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回列表
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
                竞技场队列 #{queue.id}
              </h1>
              <p className="text-gray-600">查看和管理批量竞技场任务详情</p>
            </div>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-5 h-5 text-purple-600 rounded"
              />
              <span className="text-sm font-medium">自动刷新</span>
            </label>
          </div>
        </div>

        {/* Queue Info Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          {/* Status */}
          <div className="flex items-center justify-between mb-4">
            <span className={`px-4 py-2 rounded-lg text-sm font-bold ${getStatusColor(queue.status)}`}>
              {queue.status.toUpperCase()}
            </span>
            <div className="text-sm text-gray-600">
              并发数: <span className="font-bold">{queue.max_concurrency}</span> |
              最大轮次: <span className="font-bold">{queue.max_rounds}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-600 mb-1">总任务数</p>
              <p className="text-3xl font-bold text-blue-900">{queue.total_tasks}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-600 mb-1">已完成</p>
              <p className="text-3xl font-bold text-green-900">{queue.completed_tasks}</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-600 mb-1">失败</p>
              <p className="text-3xl font-bold text-red-900">{queue.failed_tasks}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-purple-600 mb-1">进度</p>
              <p className="text-3xl font-bold text-purple-900">{Math.round(progress)}%</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
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
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {queue.status === 'running' && (
              <>
                <button
                  onClick={() => handleAction('pause')}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold"
                >
                  暂停
                </button>
                <button
                  onClick={() => handleAction('cancel')}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold"
                >
                  取消
                </button>
              </>
            )}

            {queue.status === 'paused' && (
              <button
                onClick={() => handleAction('resume')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
              >
                继续
              </button>
            )}
          </div>

          {/* Current Task */}
          {queue.current_task && (
            <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-700 mb-1">当前任务</p>
              <p className="text-blue-900 flex items-center">
                <span className="animate-pulse mr-2">...</span>
                {queue.current_task}
              </p>
            </div>
          )}

          {/* Error Message */}
          {queue.error_message && (
            <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-1">错误信息</p>
              <p className="text-red-900">{queue.error_message}</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'running', 'completed', 'failed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    filter === status
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? '全部' : status.toUpperCase()}
                  <span className="ml-2 text-xs opacity-75">
                    ({stats[status] || 0})
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="搜索模型、问题或答案..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800">
              任务详情
              <span className="text-lg text-gray-500 ml-2">
                (显示 {filteredTasks.length} / {queue.tasks.length})
              </span>
            </h2>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="p-16 text-center">
              <div className="text-6xl mb-4">?</div>
              <p className="text-xl text-gray-500">没有找到匹配的任务</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task, index) => (
                <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className={`border-2 rounded-xl p-4 ${getStatusColor(task.status)}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3 flex-1">
                        <span className="text-2xl">{getStatusIcon(task.status)}</span>
                        <div className="flex-1">
                          <h4 className="font-bold text-sm">
                            #{task.id} - {task.model_name}
                          </h4>
                          <p className="text-xs opacity-75">
                            轮次: {task.current_round}/{queue.max_rounds}
                            {task.is_agreed ? ' | 已达成一致' : ''}
                            {task.needs_judgment ? ' | 需要裁决' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getStatusColor(task.status)}`}>
                          {task.status.toUpperCase()}
                        </span>
                        {task.session_id && (
                          <Link
                            href={`/arena/view/${task.session_id}`}
                            target="_blank"
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                          >
                            查看会话
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="font-semibold">问题: </span>
                        <span className="line-clamp-2">{task.question_content}</span>
                      </div>
                      <div>
                        <span className="font-semibold">答案: </span>
                        <span className="line-clamp-2">{task.answer_content}</span>
                      </div>

                      {task.error_message && (
                        <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                          <span className="font-semibold text-red-700">错误: </span>
                          <span className="text-red-600">{task.error_message}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-current opacity-50 text-xs">
                      <span>创建: {new Date(task.created_at).toLocaleString('zh-CN')}</span>
                      {task.completed_at && (
                        <span>完成: {new Date(task.completed_at).toLocaleString('zh-CN')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
