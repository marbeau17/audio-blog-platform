import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'コンテンツ一覧',
  description: '音声配信・ブログコンテンツを探そう。ビジネス、テクノロジー、自己啓発など多彩なカテゴリから選べます。',
};

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
