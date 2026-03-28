'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import SearchBar from '@/components/search/SearchBar';

export default function Header() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14">
        <Link href="/" className="text-xl font-bold text-brand-700">
          AudioBlog
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/content" className="text-gray-600 hover:text-gray-900">コンテンツ</Link>
          <Link href="/content?pricing=free" className="text-gray-600 hover:text-gray-900">無料</Link>
          <Link href="/content?sort=popular" className="text-gray-600 hover:text-gray-900">人気</Link>
        </nav>

        <SearchBar className="hidden md:block w-64 lg:w-80" />

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          ) : user ? (
            <>
              {user.role === 'creator' || user.role === 'admin' ? (
                <Link href="/creator" className="btn-secondary text-xs">ダッシュボード</Link>
              ) : null}
              <div className="relative group">
                <button className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                    {user.displayName?.[0] || user.email[0].toUpperCase()}
                  </div>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="px-4 py-2 text-xs text-gray-500 border-b">{user.email}</div>
                  <Link href="/profile" className="block px-4 py-2 text-sm hover:bg-gray-50">プロフィール</Link>
                  <Link href="/purchases" className="block px-4 py-2 text-sm hover:bg-gray-50">購入履歴</Link>
                  {user.role === 'admin' && (
                    <Link href="/admin" className="block px-4 py-2 text-sm hover:bg-gray-50">管理者</Link>
                  )}
                  <button onClick={signOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                    ログアウト
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn-secondary text-xs">ログイン</Link>
              <Link href="/auth/register" className="btn-primary text-xs">新規登録</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
