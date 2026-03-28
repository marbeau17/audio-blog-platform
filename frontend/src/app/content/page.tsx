'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Content, Category } from '@/types';
import ContentCard from '@/components/content/ContentCard';

export default function ContentListPage() {
  const searchParams = useSearchParams();
  const [contents, setContents] = useState<Content[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'newest';
  const pricing = searchParams.get('pricing') || '';

  const fetchContents = async (loadMore = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (sort) params.set('sort', sort);
      if (pricing) params.set('pricing', pricing);
      if (loadMore && cursor) params.set('cursor', cursor);
      params.set('limit', '20');

      const res = await api.get<Content[]>(`/contents?${params}`);
      const newItems = res.data;
      setContents(loadMore ? [...contents, ...newItems] : newItems);
      setCursor(res.pagination?.cursor || null);
      setHasMore(res.pagination?.has_more || false);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get<Category[]>('/categories').then((res) => setCategories(res.data)).catch(() => {});
    fetchContents();
  }, [category, sort, pricing]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">コンテンツ一覧</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link href="/content" className={`px-3 py-1.5 rounded-full text-sm ${!category ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          すべて
        </Link>
        {categories.map((cat) => (
          <Link key={cat.id} href={`/content?category=${cat.id}`}
            className={`px-3 py-1.5 rounded-full text-sm ${category === cat.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {cat.name}
          </Link>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-4 mb-6 text-sm">
        {[
          { key: 'newest', label: '新着' },
          { key: 'popular', label: '人気' },
          { key: 'rating', label: '評価順' },
        ].map((s) => (
          <Link key={s.key} href={`/content?sort=${s.key}${category ? `&category=${category}` : ''}`}
            className={sort === s.key ? 'text-brand-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}>
            {s.label}
          </Link>
        ))}
      </div>

      {/* Grid */}
      {loading && contents.length === 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-64 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : contents.length === 0 ? (
        <p className="text-gray-500 text-center py-12">コンテンツが見つかりません</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contents.map((c) => <ContentCard key={c.content_id} content={c} />)}
          </div>
          {hasMore && (
            <div className="text-center mt-8">
              <button onClick={() => fetchContents(true)} disabled={loading} className="btn-secondary">
                {loading ? '読み込み中...' : 'もっと見る'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
