'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, Play, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useAppStore } from '@/store';
import type { Purchase, Content } from '@/types';

const LIMIT = 20;

export default function PurchasesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const setCurrentContent = useAppStore((s) => s.setCurrentContent);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const fetchPurchases = useCallback(async (nextCursor?: string | null) => {
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

      const res = await api.get<Purchase[]>(`/payment/purchases?${params}`);
      if (isLoadMore) {
        setPurchases((prev) => [...prev, ...res.data]);
      } else {
        setPurchases(res.data);
      }
      setCursor(res.pagination?.cursor ?? null);
      setHasMore(res.pagination?.has_more ?? false);
    } catch (err: unknown) {
      console.error('Failed to fetch purchases:', err);
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
      fetchPurchases();
    }
  }, [user, authLoading, router, fetchPurchases]);

  const handlePlay = async (purchase: Purchase) => {
    setPlayingId(purchase.content_id);
    try {
      const res = await api.get<Content>(`/contents/${purchase.content_id}`);
      setCurrentContent(res.data);
    } catch (err: unknown) {
      console.error('Failed to load content:', err);
    } finally {
      setPlayingId(null);
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
      <h1 className="text-2xl font-bold mb-8">購入履歴</h1>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-4">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/4 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-1/5" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && purchases.length === 0 && (
        <div className="text-center py-20">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-1">購入履歴はありません</p>
          <p className="text-gray-500 text-sm mb-6">
            No purchases yet. Browse content to get started!
          </p>
          <Link href="/content" className="btn-primary inline-flex items-center gap-2">
            コンテンツを探す
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Purchase list */}
      {!loading && purchases.length > 0 && (
        <div className="space-y-3">
          {purchases.map((purchase) => (
            <div
              key={purchase.purchase_id}
              className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-brand-300 hover:shadow-sm transition-all"
            >
              {/* Play button */}
              <button
                onClick={() => handlePlay(purchase)}
                disabled={playingId === purchase.content_id}
                className="shrink-0 w-10 h-10 rounded-full bg-brand-100 text-brand-700 hover:bg-brand-200 flex items-center justify-center transition-colors disabled:opacity-50"
                title="再生"
              >
                {playingId === purchase.content_id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              {/* Content info */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/content/${purchase.content_id}`}
                  className="font-medium text-gray-900 hover:text-brand-600 truncate block transition-colors"
                >
                  {purchase.content_title}
                </Link>
                <p className="text-sm text-gray-500 truncate">
                  {purchase.creator_display_name}
                </p>
              </div>

              {/* Price & date */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium text-gray-900">
                  {purchase.price_jpy.toLocaleString()}円
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(purchase.purchased_at)}
                </p>
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="text-center mt-6">
              <button
                onClick={() => fetchPurchases(cursor)}
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
        </div>
      )}
    </div>
  );
}
