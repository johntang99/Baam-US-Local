import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Baam Middletown · Your Local Community Hub',
  description: 'Local businesses, news, events, and community for Middletown, NY. Find everything you need in one place.',
  icons: {
    icon: '/icon',
    shortcut: '/icon',
    apple: '/icon',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
