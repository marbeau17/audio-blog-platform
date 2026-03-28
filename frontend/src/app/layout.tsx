import type { Metadata } from 'next';
import './globals.css';
import AudioPlayer from '@/components/player/AudioPlayer';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'AudioBlog - 音声配信・ブログプラットフォーム',
  description: 'テキストコンテンツを音声化して配信。ビジネス書・自己啓発本を耳で楽しむ。',
  openGraph: {
    title: 'AudioBlog',
    description: '音声配信・ブログ統合プラットフォーム',
    type: 'website',
  },
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
