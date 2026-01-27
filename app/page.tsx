// app/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n/context';

interface ModelScoreData {
  total_score: number;
  dimensions: {
    [dimensionName: string]: number;
  };
}

interface Model {
  id: number;
  name: string;
  average_score: string | null;
}

interface Dimension {
  id: number;
  name: string;
}

export default function Home() {
  const { t } = useTranslation();
  const [models, setModels] = useState<Model[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [expertModel, setExpertModel] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [modelsRes, dimensionsRes, configRes] = await Promise.all([
          fetch('/api/models'),
          fetch('/api/dimensions'),
          fetch('/api/config'),
        ]);
        const [modelsData, dimensionsData, configData] = await Promise.all([
          modelsRes.json(),
          dimensionsRes.json(),
          configRes.json(),
        ]);
        setModels(modelsData);
        setDimensions(dimensionsData);
        setExpertModel(configData.expertModel || '');
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Parse model scores
  const modelsWithScores = models.map(model => {
    let scoreData: ModelScoreData | null = null;
    let displayScore: string | null = null;

    if (model.average_score) {
      try {
        const parsed = JSON.parse(model.average_score);
        if (parsed && typeof parsed === 'object' && 'total_score' in parsed) {
          scoreData = parsed;
          displayScore = parsed.total_score.toFixed(2);
        }
      } catch {
        const numScore = parseFloat(model.average_score);
        if (!isNaN(numScore)) {
          displayScore = numScore.toFixed(2);
        }
      }
    }

    return {
      ...model,
      scoreData,
      displayScore
    };
  });

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
    <div className="container mx-auto px-4 py-12 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
            AI Benchmark
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t('home.subtitle')}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-2xl shadow-lg p-6 card-hover animate-slide-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">{t('home.totalModels')}</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{models.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">
                🤖
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 card-hover animate-slide-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">{t('home.scoringDimensions')}</p>
                <p className="text-3xl font-bold text-pink-600 mt-2">{dimensions.length}</p>
              </div>
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-2xl">
                📊
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 card-hover animate-slide-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-gray-500 text-sm font-medium mb-2">{t('home.expertModel')}</p>
                <p className="text-lg font-bold text-blue-600 truncate" title={expertModel}>
                  {expertModel}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0 ml-3">
                ⭐
              </div>
            </div>
          </div>
        </div>

        {/* Models Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-800">{t('home.modelList')}</h2>
            <Link
              href="/settings/models"
              className="px-6 py-3 bg-gradient-primary text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 btn-shine"
            >
              {t('home.addModel')}
            </Link>
          </div>

          {models.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🤖</div>
              <p className="text-xl text-gray-500 mb-6">{t('home.noModels')}</p>
              <Link
                href="/settings/models"
                className="inline-block px-8 py-4 bg-gradient-primary text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300"
              >
                {t('home.addNow')}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modelsWithScores.map((model, index) => (
                <Link
                  key={model.id}
                  href={`/models/${model.id}`}
                  className="group block animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="relative p-6 bg-gradient-to-br from-white to-purple-50 rounded-2xl border-2 border-purple-100 hover:border-purple-300 transition-all duration-300 card-hover">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-primary opacity-10 rounded-bl-full"></div>

                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0">
                        {model.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-800 mb-2 truncate group-hover:text-purple-600 transition-colors">
                          {model.name}
                        </h3>
                        <div className="flex items-center text-sm text-gray-500 space-x-2">
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            {t('common.ready')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center text-sm">
                      <span className="text-purple-600 font-semibold group-hover:translate-x-1 transition-transform">
                        {t('common.viewDetails')}
                      </span>
                      <span className="text-gray-400">ID: {model.id}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
