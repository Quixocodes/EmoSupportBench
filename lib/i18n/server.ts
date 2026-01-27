// Server-side translation utility for API routes
import en from './locales/en';
import zh from './locales/zh';

type Locale = 'en' | 'zh';

const translations = { en, zh } as const;

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return typeof current === 'string' ? current : undefined;
}

export function getServerTranslation(locale: Locale = 'en') {
  return function t(key: string, params?: Record<string, string | number>): string {
    const dict = translations[locale];
    let value = getNestedValue(dict, key);

    if (value === undefined) {
      value = getNestedValue(translations.en, key);
    }

    if (value === undefined) {
      return key;
    }

    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`;
      });
    }

    return value;
  };
}
