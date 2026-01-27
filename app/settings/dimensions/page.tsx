'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';

interface Dimension {
  id: number;
  name: string;
  prompt: string;
}

export default function DimensionsPage() {
  const { t } = useTranslation();
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrompt, setEditPrompt] = useState('');

  useEffect(() => {
    loadDimensions();
  }, []);

  const loadDimensions = async () => {
    const response = await fetch('/api/dimensions');
    const data = await response.json();
    setDimensions(data);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;

    await fetch('/api/dimensions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, prompt: newPrompt }),
    });

    setNewName('');
    setNewPrompt('');
    await loadDimensions();
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim() || !editPrompt.trim()) return;

    await fetch(`/api/dimensions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, prompt: editPrompt }),
    });

    setEditingId(null);
    setEditName('');
    setEditPrompt('');
    await loadDimensions();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('settings.dimensions.confirmDelete'))) return;

    await fetch(`/api/dimensions/${id}`, {
      method: 'DELETE',
    });

    await loadDimensions();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            {`← ${t('common.backHome')}`}
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8 text-gray-800">{t('settings.dimensions.title')}</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">{t('settings.dimensions.addNew')}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('settings.dimensions.dimensionName')}
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={t('settings.dimensions.namePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('settings.dimensions.scoringPrompt')}
              </label>
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                rows={4}
                placeholder={t('settings.dimensions.promptPlaceholder')}
              />
            </div>
            <button
              onClick={handleCreate}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-2 rounded-lg transition"
            >
              {t('common.add')}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">{t('settings.dimensions.list')}</h2>

          {dimensions.length === 0 ? (
            <p className="text-gray-500">{t('settings.dimensions.noDimensions')}</p>
          ) : (
            <div className="space-y-4">
              {dimensions.map((dimension) => (
                <div key={dimension.id} className="border border-gray-200 rounded-lg p-4">
                  {editingId === dimension.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('settings.dimensions.dimensionName')}
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          {t('settings.dimensions.scoringPrompt')}
                        </label>
                        <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          rows={4}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(dimension.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditName('');
                            setEditPrompt('');
                          }}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{dimension.name}</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingId(dimension.id);
                              setEditName(dimension.name);
                              setEditPrompt(dimension.prompt);
                            }}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition"
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            onClick={() => handleDelete(dimension.id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm">{dimension.prompt}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
