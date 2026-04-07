export const locales = ['en', 'zh'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

// Chinese script variants — not used for English platform
export type ChineseScript = 'simplified' | 'traditional';
