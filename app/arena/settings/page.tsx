// app/arena/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';

interface Expert {
  id: number;
  expert_type: 'A' | 'B' | 'C';
  model_name: string;
  prompt: string;
}

export default function ArenaSettingsPage() {
  const { t, locale } = useTranslation();

  const [experts, setExperts] = useState<Expert[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editModel, setEditModel] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExperts();
  }, []);

  const loadExperts = async () => {
    const res = await fetch('/api/arena/experts');
    const data = await res.json();
    setExperts(data);
  };

  const startEdit = (expert: Expert) => {
    setEditingId(expert.id);
    setEditModel(expert.model_name);
    setEditPrompt(expert.prompt);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditModel('');
    setEditPrompt('');
  };

  const saveEdit = async (id: number) => {
    setLoading(true);
    try {
      await fetch('/api/arena/experts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          model_name: editModel,
          prompt: editPrompt,
        }),
      });

      await loadExperts();
      cancelEdit();
    } catch (error) {
      console.error('Failed to update expert:', error);
      alert(t('arenaSettings.updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getExpertInfo = (type: string) => {
    switch (type) {
      case 'A':
        return {
          title: t('arenaSettings.expertATitle'),
          icon: '🔵',
          color: 'blue',
          description: t('arenaSettings.expertADesc'),
        };
      case 'B':
        return {
          title: t('arenaSettings.expertBTitle'),
          icon: '🟢',
          color: 'green',
          description: t('arenaSettings.expertBDesc'),
        };
      case 'C':
        return {
          title: t('arenaSettings.judgeCTitle'),
          icon: '🟣',
          color: 'purple',
          description: t('arenaSettings.judgeCDesc'),
        };
      default:
        return { title: '', icon: '', color: 'gray', description: '' };
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/arena" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('common.backArena')}
          </Link>

          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
            {t('arenaSettings.title')}
          </h1>
          <p className="text-gray-600">{t('arenaSettings.subtitle')}</p>
        </div>

        {/* Expert Cards */}
        <div className="space-y-6">
          {experts.map((expert) => {
            const info = getExpertInfo(expert.expert_type);
            const isEditing = editingId === expert.id;

            return (
              <div
                key={expert.id}
                className={`bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-${info.color}-200`}
              >
                <div className={`bg-${info.color}-50 p-6 border-b-2 border-${info.color}-200`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800 mb-1">
                        {info.icon} {info.title}
                      </h2>
                      <p className="text-sm text-gray-600">{info.description}</p>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(expert)}
                        className={`px-4 py-2 bg-${info.color}-600 hover:bg-${info.color}-700 text-white font-semibold rounded-lg transition-colors`}
                      >
                        {t('common.edit')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('arenaSettings.modelName')}
                        </label>
                        <input
                          type="text"
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder={t('arenaSettings.modelPlaceholder')}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('arenaSettings.systemPrompt')}
                        </label>
                        <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                          rows={6}
                          placeholder={t('arenaSettings.promptPlaceholder')}
                        />
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => saveEdit(expert.id)}
                          disabled={loading}
                          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {loading ? t('common.saving') : t('common.save')}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={loading}
                          className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">{t('arenaSettings.modelName')}</p>
                        <p className="text-gray-800 font-mono bg-gray-50 px-3 py-2 rounded-lg">
                          {expert.model_name}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">{t('arenaSettings.systemPrompt')}</p>
                        <p className="text-gray-700 bg-gray-50 px-3 py-2 rounded-lg whitespace-pre-wrap">
                          {expert.prompt}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tips */}
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-blue-800 mb-3">{t('arenaSettings.tipsTitle')}</h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>{t('arenaSettings.tip1')}</li>
            <li>{t('arenaSettings.tip2')}</li>
            <li>{t('arenaSettings.tip3')}</li>
            <li>{t('arenaSettings.tip4')}</li>
            <li>{t('arenaSettings.tip5')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
