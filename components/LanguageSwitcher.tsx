'use client';

import { useTranslation } from '@/lib/i18n/context';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
      className="px-3 py-1.5 text-sm font-semibold rounded-lg border-2 border-purple-200 hover:border-purple-400 bg-white hover:bg-purple-50 text-purple-700 transition-all duration-200"
      title={locale === 'en' ? 'Switch to Chinese' : '切换到英文'}
    >
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  );
}
