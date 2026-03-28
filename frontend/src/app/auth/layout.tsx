import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ログイン・登録',
  description: 'AudioBlogにログインまたは新規登録して、音声コンテンツを楽しもう。',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
