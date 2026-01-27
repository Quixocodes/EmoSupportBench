'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';

interface Model {
  id: number;
  name: string;
}

export default function ModelsPage() {
  const { t } = useTranslation();
  const [models, setModels] = useState<Model[]>([]);
  const [newModel, setNewModel] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    const response = await fetch('/api/models');
    const data = await response.json();
    setModels(data);
  };

  const handleCreate = async () => {
    if (!newModel.trim()) return;

    await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newModel }),
    });

    setNewModel('');
    await loadModels();
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;

    await fetch(`/api/models/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    });

    setEditingId(null);
    setEditName('');
    await loadModels();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('settings.models.confirmDelete'))) return;

    await fetch(`/api/models/${id}`, {
      method: 'DELETE',
    });

    await loadModels();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            {`← ${t('common.backHome')}`}
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8 text-gray-800">{t('settings.models.title')}</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">{t('settings.models.addNew')}</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder={t('settings.models.modelPlaceholder')}
            />
            <button
              onClick={handleCreate}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 rounded-lg transition"
            >
              {t('common.add')}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">{t('settings.models.list')}</h2>

          {models.length === 0 ? (
            <p className="text-gray-500">{t('settings.models.noModels')}</p>
          ) : (
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="border border-gray-200 rounded-lg p-4">
                  {editingId === model.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        onClick={() => handleUpdate(model.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditName('');
                        }}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <p className="text-gray-800 font-mono">{model.name}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingId(model.id);
                            setEditName(model.name);
                          }}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(model.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
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
