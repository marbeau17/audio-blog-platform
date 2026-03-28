'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, FileText, User, Mic } from 'lucide-react';
import { api } from '@/lib/api';

interface ContentResult {
  content_id: string;
  title: string;
  excerpt: string;
  creator_display_name: string;
  has_audio: boolean;
  pricing: {
    type: 'free' | 'paid';
    price_jpy: number;
  };
  slug: string;
}

interface CreatorResult {
  uid: string;
  display_name: string;
  avatar_url: string | null;
  content_count: number;
  follower_count: number;
}

interface SearchResponse {
  contents: ContentResult[];
  creators: CreatorResult[];
  total_contents: number;
  total_creators: number;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [contentPage, setContentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const LIMIT = 10;

  const fetchResults = useCallback(async (q: string, page = 1, append = false) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('q', q.trim());
      params.set('limit', String(LIMIT));
      params.set('offset', String((page - 1) * LIMIT));

      const res = await api.get<SearchResponse>(`/search?${params}`);

      if (append && results) {
        setResults({
          ...res.data,
          contents: [...results.contents, ...res.data.contents],
          creators: results.creators,
          total_creators: results.total_creators,
        });
      } else {
        setResults(res.data);
      }
    } catch {
      if (!append) setResults(null);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [results]);

  useEffect(() => {
    setContentPage(1);
    fetchResults(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleLoadMore = () => {
    const nextPage = contentPage + 1;
    setContentPage(nextPage);
    fetchResults(query, nextPage, true);
  };

  const hasMoreContents = results ? results.contents.length < results.total_contents : false;
  const hasResults = results && (results.contents.length > 0 || results.creators.length > 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">検索結果</h1>
        {query && (
          <p className="text-gray-500">
            「<span className="font-medium text-gray-700">{query}</span>」の検索結果
            {results && (
              <span className="ml-2 text-sm">
                ({results.total_contents + results.total_creators}件)
              </span>
            )}
          </p>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      )}

      {/* No query */}
      {!query && !loading && (
        <div className="text-center py-20">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">検索キーワードを入力してください</p>
        </div>
      )}

      {/* No results */}
      {query && !loading && results && !hasResults && (
        <div className="text-center py-20">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-1">検索結果が見つかりませんでした</p>
          <p className="text-gray-500 text-sm">
            別のキーワードで検索してみてください
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && hasResults && (
        <div className="space-y-10">
          {/* Creators section */}
          {results!.creators.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-brand-600" />
                クリエイター
                <span className="text-sm font-normal text-gray-400">
                  ({results!.total_creators}件)
                </span>
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {results!.creators.map((creator) => (
                  <Link
                    key={creator.uid}
                    href={`/creator/${creator.uid}`}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-bold shrink-0">
                      {creator.avatar_url ? (
                        <img
                          src={creator.avatar_url}
                          alt={creator.display_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        creator.display_name[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {creator.display_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        コンテンツ {creator.content_count}件 ・ フォロワー {creator.follower_count}人
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Contents section */}
          {results!.contents.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" />
                コンテンツ
                <span className="text-sm font-normal text-gray-400">
                  ({results!.total_contents}件)
                </span>
              </h2>
              <div className="space-y-3">
                {results!.contents.map((content) => (
                  <Link
                    key={content.content_id}
                    href={`/content/${content.slug}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-gray-900 mb-1 truncate">
                          {content.title}
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                          {content.excerpt}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>{content.creator_display_name}</span>
                          {content.has_audio && (
                            <span className="inline-flex items-center gap-1 text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                              <Mic className="w-3 h-3" />
                              音声あり
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {content.pricing.type === 'free' ? (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">
                            無料
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                            {content.pricing.price_jpy.toLocaleString()}円
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Load more */}
              {hasMoreContents && (
                <div className="text-center mt-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="btn-secondary"
                  >
                    {loadingMore ? '読み込み中...' : 'もっと見る'}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
