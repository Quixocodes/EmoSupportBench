'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/context';

interface Model {
  id: number;
  name: string;
}

interface Question {
  id: number;
  content: string;
}

interface Dimension {
  id: number;
  name: string;
}

export default function ExportPage() {
  const { t, locale } = useTranslation();
  const [models, setModels] = useState<Model[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [selectedModels, setSelectedModels] = useState<number[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [modelsRes, questionsRes, dimensionsRes] = await Promise.all([
        fetch('/api/models'),
        fetch('/api/questions'),
        fetch('/api/dimensions')
      ]);

      const [modelsData, questionsData, dimensionsData] = await Promise.all([
        modelsRes.json(),
        questionsRes.json(),
        dimensionsRes.json()
      ]);

      setModels(modelsData);
      setQuestions(questionsData);
      setDimensions(dimensionsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      alert(t('export.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleModelSelection = (modelId: number) => {
    setSelectedModels(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const toggleQuestionSelection = (questionId: number) => {
    setSelectedQuestions(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const selectAllModels = () => {
    if (selectedModels.length === models.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(models.map(m => m.id));
    }
  };

  const selectAllQuestions = () => {
    if (selectedQuestions.length === questions.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(questions.map(q => q.id));
    }
  };

  const handleExport = async () => {
    if (selectedModels.length === 0 || selectedQuestions.length === 0) {
      alert(t('export.selectAtLeastOne'));
      return;
    }

    setExporting(true);
    setProgress(0);

    try {
      const response = await fetch('/api/export/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelIds: selectedModels,
          questionIds: selectedQuestions
        })
      });

      if (!response.ok) {
        throw new Error(t('export.exportFailed'));
      }

      // 获取文件blob
      const blob = await response.blob();
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('export.exportFileName')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setProgress(100);
      alert(t('export.exportSuccess'));
    } catch (error) {
      console.error('Export failed:', error);
      alert(t('export.exportRetry'));
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  const stats = useMemo(() => {
    return {
      selectedModels: selectedModels.length,
      selectedQuestions: selectedQuestions.length,
      totalCombinations: selectedModels.length * selectedQuestions.length,
      dimensions: dimensions.length
    };
  }, [selectedModels, selectedQuestions, dimensions]);

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
          <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('common.backHome')}
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent mb-2">
                {t('export.title')}
              </h1>
              <p className="text-gray-600">{t('export.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <p className="text-sm font-semibold text-gray-600 mb-1">{t('export.selectedModels')}</p>
            <p className="text-3xl font-bold text-purple-600">{stats.selectedModels}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <p className="text-sm font-semibold text-gray-600 mb-1">{t('export.selectedQuestions')}</p>
            <p className="text-3xl font-bold text-blue-600">{stats.selectedQuestions}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <p className="text-sm font-semibold text-gray-600 mb-1">{t('export.scoringDimensions')}</p>
            <p className="text-3xl font-bold text-green-600">{stats.dimensions}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
            <p className="text-sm font-semibold text-gray-600 mb-1">{t('export.estimatedRows')}</p>
            <p className="text-3xl font-bold text-orange-600">{stats.totalCombinations}</p>
          </div>
        </div>

        {/* 选择区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 模型选择 */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <span className="mr-2">🤖</span>
                {t('export.selectModels')}
              </h2>
              <button
                onClick={selectAllModels}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {selectedModels.length === models.length ? t('common.deselectAll') : t('common.selectAll')}
              </button>
            </div>

            <div className="border-2 border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto">
              {models.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">{t('export.noModels')}</p>
                  <Link href="/settings/models" className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">
                    {t('export.goAddModel')}
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {models.map(model => (
                    <label
                      key={model.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                        selectedModels.includes(model.id)
                          ? 'bg-purple-50 border-purple-500'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedModels.includes(model.id)}
                        onChange={() => toggleModelSelection(model.id)}
                        className="w-5 h-5 text-purple-600 rounded"
                      />
                      <span className="flex-1 font-medium text-gray-800">{model.name}</span>
                      <span className="text-xs text-gray-500">ID: {model.id}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 mt-3">
              {t('export.selectedModelCount', { count: selectedModels.length, total: models.length })}
            </p>
          </div>

          {/* 问题选择 */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <span className="mr-2">❓</span>
                {t('export.selectQuestions')}
              </h2>
              <button
                onClick={selectAllQuestions}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {selectedQuestions.length === questions.length ? t('common.deselectAll') : t('common.selectAll')}
              </button>
            </div>

            <div className="border-2 border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto">
              {questions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">{t('export.noQuestions')}</p>
                  <Link href="/settings/questions" className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">
                    {t('export.goAddQuestion')}
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {questions.map(question => (
                    <label
                      key={question.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                        selectedQuestions.includes(question.id)
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(question.id)}
                        onChange={() => toggleQuestionSelection(question.id)}
                        className="mt-1 w-5 h-5 text-blue-600 rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 line-clamp-2">{question.content}</p>
                        <p className="text-xs text-gray-500 mt-1">ID: {question.id}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <p className="text-sm text-gray-600 mt-3">
              {t('export.selectedQuestionCount', { count: selectedQuestions.length, total: questions.length })}
            </p>
          </div>
        </div>

        {/* 导出预览 */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-xl p-8 mb-6 border-2 border-purple-200">
          <h2 className="text-2xl font-bold text-purple-800 mb-4 flex items-center">
            <span className="mr-2">📋</span>
            {t('export.exportPreview')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-gray-700 mb-3">{t('export.excelStructure')}</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{t('export.sheetsCount', { count: selectedModels.length })}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{t('export.rowsPerSheet', { count: selectedQuestions.length })}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{t('export.columnStructure', { count: dimensions.length })}</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold text-gray-700 mb-3">{t('export.dataStats')}</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{t('export.totalDataPoints', { count: stats.totalCombinations * stats.dimensions })}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{t('export.includedDimensions', { names: dimensions.map(d => d.name).join('、') })}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 导出按钮 */}
        <div className="text-center">
          <button
            onClick={handleExport}
            disabled={exporting || selectedModels.length === 0 || selectedQuestions.length === 0}
            className="px-12 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <span className="flex items-center">
                <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('export.exporting')} {progress > 0 && `${Math.round(progress)}%`}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('export.exportExcel')}
              </span>
            )}
          </button>

          {selectedModels.length === 0 || selectedQuestions.length === 0 ? (
            <p className="text-sm text-red-600 mt-3">
              {t('export.selectAtLeastOne')}
            </p>
          ) : (
            <p className="text-sm text-gray-600 mt-3">
              {t('export.willExport', { models: selectedModels.length, questions: selectedQuestions.length })}
            </p>
          )}
        </div>

        {/* 使用说明 */}
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-blue-800 mb-3">{t('export.usageTitle')}</h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>{t('export.usage1')}</li>
            <li>{t('export.usage2')}</li>
            <li>{t('export.usage3')}</li>
            <li>{t('export.usage4')}</li>
            <li>{t('export.usage5')}</li>
            <li>{t('export.usage6')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
