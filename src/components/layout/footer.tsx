'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/routing';

export function Footer() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');

  return (
    <footer className="bg-gray-900 text-gray-400 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
                B
              </div>
              <span className="text-xl font-bold text-white">Baam Middletown</span>
            </div>
            <p className="text-sm leading-relaxed">
              Your local community hub for Middletown, NY. News, businesses, events, and community — all in one place.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4">
              {t('quickLinks')}
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/news" className="hover:text-white transition">
                  {nav('news')}
                </Link>
              </li>
              <li>
                <Link href="/guides" className="hover:text-white transition">
                  {nav('guides')}
                </Link>
              </li>
              <li>
                <Link href="/forum" className="hover:text-white transition">
                  {nav('forum')}
                </Link>
              </li>
              <li>
                <Link href="/businesses" className="hover:text-white transition">
                  {nav('businesses')}
                </Link>
              </li>
              <li>
                <Link href="/events" className="hover:text-white transition">
                  {nav('events')}
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-white transition">
                  {nav('services')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Business Services */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4">
              {t('businessServices')}
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition">
                  {t('businessRegister')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {t('adCooperation')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {t('voiceApply')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {t('productPlans')}
                </a>
              </li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="text-white font-semibold text-sm mb-4">
              {t('about')}
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition">
                  {t('aboutBaam')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {t('contactUs')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {t('termsOfService')}
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  {t('privacyPolicy')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">
            {t('copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-4 text-xs">
            <span>Facebook</span>
            <span>Instagram</span>
            <span>X (Twitter)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
