import type { Metadata } from 'next';
import './globals.css';
import AudioPlayer from '@/components/player/AudioPlayer';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: {
    default: 'AudioBlog - 音声配信・ブログプラットフォーム',
    template: '%s | AudioBlog',
  },
  description: 'テキストを音声に変換して配信するプラットフォーム。ビジネス書・自己啓発本などを音声で楽しもう。',
  keywords: ['音声配信', 'ブログ', 'TTS', 'オーディオブック', 'ポッドキャスト', 'AudioBlog'],
  authors: [{ name: 'AudioBlog' }],
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: 'AudioBlog',
    title: 'AudioBlog - 音声配信・ブログプラットフォーム',
    description: 'テキストを音声に変換して配信するプラットフォーム',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AudioBlog',
    description: 'テキストを音声に変換して配信するプラットフォーム',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AudioBlog" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="font-sans bg-gray-50 text-gray-900 antialiased">
        <Header />
        <main className="min-h-screen pb-24">{children}</main>
        <AudioPlayer />
      </body>
    </html>
  );
}
