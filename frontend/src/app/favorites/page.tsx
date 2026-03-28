'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { Favorite } from '@/types';

const LIMIT = 20;

export default function FavoritesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchFavorites = useCallback(async (nextCursor?: string | null) => {
    const isLoadMore = !!nextCursor;
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('limit', String(LIMIT));
      if (nextCursor) {
        params.set('cursor', nextCursor);
      }

      const res = await api.get<Favorite[]>(`/favorites?${params}`);
      if (isLoadMore) {
        setFavorites((prev) => [...prev, ...res.data]);
      } else {
        setFavorites(res.data);
      }
      setCursor(res.pagination?.cursor ?? null);
      setHasMore(res.pagination?.has_more ?? false);
    } catch (err: unknown) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (user) {
      fetchFavorites();
    }
  }, [user, authLoading, router, fetchFavorites]);

  const handleRemove = async (contentId: string) => {
    setRemovingId(contentId);

    // Optimistic removal
    const prev = favorites;
    setFavorites((f) => f.filter((item) => item.content_id !== contentId));

    try {
      await api.delete(`/favorites/${contentId}`);
    } catch (err: unknown) {
      console.error('Failed to remove favorite:', err);
      // Revert on error
      setFavorites(prev);
    } finally {
      setRemovingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">お気に入り</h1>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse border border-gray-200 rounded-lg overflow-hidden">
              <div className="aspect-video bg-gray-200" />
              <div className="p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && favorites.length === 0 && (
        <div className="text-center py-20">
          <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-1">お気に入りはまだありません</p>
          <p className="text-gray-500 text-sm mb-6">
            気になるコンテンツをお気に入りに追加しましょう
          </p>
          <Link href="/content" className="btn-primary inline-flex items-center gap-2">
            コンテンツを探す
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Favorites grid */}
      {!loading && favorites.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((fav) => (
              <div
                key={fav.content_id}
                className="card hover:shadow-md transition group relative"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-100">
                  {fav.thumbnail_url ? (
                    <img
                      src={fav.thumbnail_url}
                      alt={fav.content_title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                      <span className="text-4xl">🎧</span>
                    </div>
                  )}

                  {/* Unfavorite button */}
                  <button
                    onClick={() => handleRemove(fav.content_id)}
                    disabled={removingId === fav.content_id}
                    title="お気に入りから削除"
                    className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-white transition disabled:opacity-50"
                  >
                    <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                  </button>
                </div>

                <Link href={`/content/${fav.content_id}`} className="block p-4">
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-brand-600 transition">
                    {fav.content_title}
                  </h3>
                  <p className="text-xs text-gray-500 mb-1">{fav.creator_display_name}</p>
                  <p className="text-xs text-gray-400">{formatDate(fav.added_at)}</p>
                </Link>
              </div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={() => fetchFavorites(cursor)}
                disabled={loadingMore}
                className="btn-secondary inline-flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    読み込み中...
                  </>
                ) : (
                  'もっと見る'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
