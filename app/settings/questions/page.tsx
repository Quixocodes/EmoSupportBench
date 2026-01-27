'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';

interface Question {
  id: number;
  content: string;
}

export default function QuestionsPage() {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    const response = await fetch('/api/questions');
    const data = await response.json();
    setQuestions(data);
  };

  const handleCreate = async () => {
    if (!newQuestion.trim()) return;

    await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newQuestion }),
    });

    setNewQuestion('');
    await loadQuestions();
  };

  const handleUpdate = async (id: number) => {
    if (!editContent.trim()) return;

    await fetch(`/api/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });

    setEditingId(null);
    setEditContent('');
    await loadQuestions();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('settings.questions.confirmDelete'))) return;

    await fetch(`/api/questions/${id}`, {
      method: 'DELETE',
    });

    await loadQuestions();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            {`← ${t('common.backHome')}`}
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-8 text-gray-800">{t('settings.questions.title')}</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">{t('settings.questions.addNew')}</h2>
          <div className="flex gap-2">
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder={t('settings.questions.placeholder')}
            />
            <button
              onClick={handleCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 rounded-lg transition"
            >
              {t('common.add')}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">{t('settings.questions.list')}</h2>

          {questions.length === 0 ? (
            <p className="text-gray-500">{t('settings.questions.noQuestions')}</p>
          ) : (
            <div className="space-y-4">
              {questions.map((question) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  {editingId === question.id ? (
                    <div className="flex gap-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleUpdate(question.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded transition"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditContent('');
                          }}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-1 rounded transition"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <p className="text-gray-800 flex-1">{question.content}</p>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => {
                            setEditingId(question.id);
                            setEditContent(question.content);
                          }}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(question.id)}
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
