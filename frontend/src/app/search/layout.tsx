import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '検索',
  description: 'AudioBlogでコンテンツやクリエイターを検索',
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
