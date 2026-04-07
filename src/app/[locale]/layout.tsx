import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import { ChineseScriptProvider } from '@/lib/i18n/chinese-converter';
import { baamTheme, generateThemeCSS } from '@/lib/theme';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();
  const themeCSS = generateThemeCSS(baamTheme);

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : locale}>
      <head>
        {/* Inject theme CSS variables */}
        <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
      </head>
      <body className="bg-bg-page text-text-primary antialiased">
        <NextIntlClientProvider messages={messages}>
          <ChineseScriptProvider>
            {children}
          </ChineseScriptProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
