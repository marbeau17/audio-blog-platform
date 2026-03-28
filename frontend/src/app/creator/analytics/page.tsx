'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3, TrendingUp, Users, Play, Star } from 'lucide-react';

/* ─── Types ────────────────────────────────────── */

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

type SortKey =
  | 'title'
  | 'plays'
  | 'completions'
  | 'completion_rate'
  | 'purchases'
  | 'revenue'
  | 'avg_rating';

type SortDir = 'asc' | 'desc';

interface ContentPerformance {
  content_id: string;
  title: string;
  plays: number;
  completions: number;
  completion_rate: number;
  purchases: number;
  revenue: number;
  avg_rating: number;
}

interface DailyPlay {
  date: string;
  count: number;
}

interface AudienceInsights {
  new_listeners: number;
  returning_listeners: number;
}

interface AnalyticsData {
  overview: {
    total_plays: number;
    unique_listeners: number;
    completion_rate: number;
    total_purchases: number;
    avg_rating: number;
  };
  content_performance: ContentPerformance[];
  daily_plays: DailyPlay[];
  audience: AudienceInsights;
}

/* ─── Helpers ──────────────────────────────────── */

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7日間' },
  { value: '30d', label: '30日間' },
  { value: '90d', label: '90日間' },
  { value: '1y', label: '1年' },
  { value: 'all', label: '全期間' },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatRating(rating: number): string {
  return rating > 0 ? rating.toFixed(1) : '-';
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/* ─── Component ────────────────────────────────── */

export default function CreatorAnalyticsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('plays');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<AnalyticsData>(`/creator/analytics?period=${period}&granularity=daily`)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  /* ─── Sorting logic ──────────────────────────── */

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const sortedContent = useMemo(() => {
    if (!data) return [];
    const list = [...data.content_performance];
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [data, sortKey, sortDir]);

  /* ─── Top performing (by plays) ──────────────── */

  const topContent = useMemo(() => {
    if (!data) return [];
    return [...data.content_performance].sort((a, b) => b.plays - a.plays).slice(0, 5);
  }, [data]);

  /* ─── Daily plays bar chart helpers ──────────── */

  const maxDailyCount = useMemo(() => {
    if (!data || data.daily_plays.length === 0) return 1;
    return Math.max(...data.daily_plays.map((d) => d.count), 1);
  }, [data]);

  /* ─── Audience percentages ───────────────────── */

  const audiencePcts = useMemo(() => {
    if (!data) return { newPct: 0, retPct: 0 };
    const total = data.audience.new_listeners + data.audience.returning_listeners;
    if (total === 0) return { newPct: 0, retPct: 0 };
    return {
      newPct: Math.round((data.audience.new_listeners / total) * 100),
      retPct: Math.round((data.audience.returning_listeners / total) * 100),
    };
  }, [data]);

  /* ─── Selected content detail ────────────────── */

  const selectedContent = useMemo(() => {
    if (!selectedContentId || !data) return null;
    return data.content_performance.find((c) => c.content_id === selectedContentId) ?? null;
  }, [selectedContentId, data]);

  /* ─── Sort indicator ─────────────────────────── */

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  /* ─── Render ─────────────────────────────────── */

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-500">
        アナリティクスの読み込みに失敗しました
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-brand-600" />
          <h1 className="text-2xl font-bold">アナリティクス</h1>
        </div>
        <Link href="/creator" className="btn-secondary text-sm">
          ダッシュボードに戻る
        </Link>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-8">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === opt.value
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Play className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl font-bold text-purple-600">{data.overview.total_plays.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">総再生数</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-blue-600">{data.overview.unique_listeners.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">ユニークリスナー</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-xl font-bold text-green-600">{pct(data.overview.completion_rate)}</p>
          <p className="text-xs text-gray-500 mt-1">完了率</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <BarChart3 className="w-4 h-4 text-orange-500" />
          </div>
          <p className="text-xl font-bold text-orange-600">{data.overview.total_purchases.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">総購入数</p>
        </div>
        <div className="card p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Star className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-xl font-bold text-yellow-600">{formatRating(data.overview.avg_rating)}</p>
          <p className="text-xs text-gray-500 mt-1">平均評価</p>
        </div>
      </div>

      {/* Daily Play Count Trend (CSS Bar Chart) */}
      <div className="card p-6 mb-8">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-600" />
          再生数トレンド
        </h2>
        {data.daily_plays.length === 0 ? (
          <p className="text-sm text-gray-400">データがありません</p>
        ) : (
          <div className="flex items-end gap-1 h-48 overflow-x-auto pb-6 relative">
            {data.daily_plays.map((day) => {
              const heightPct = (day.count / maxDailyCount) * 100;
              return (
                <div
                  key={day.date}
                  className="flex flex-col items-center flex-1 min-w-[28px]"
                  style={{ height: '100%' }}
                >
                  <span className="text-[10px] text-gray-500 mb-1">{day.count}</span>
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className="w-full bg-brand-500 rounded-t hover:bg-brand-600 transition-colors"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                      title={`${day.date}: ${day.count}再生`}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
                    {formatDate(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Top Performing Content Ranking */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            トップコンテンツ
          </h2>
          {topContent.length === 0 ? (
            <p className="text-sm text-gray-400">データがありません</p>
          ) : (
            <div className="space-y-3">
              {topContent.map((c, i) => (
                <div key={c.content_id} className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                      i === 0
                        ? 'bg-yellow-100 text-yellow-700'
                        : i === 1
                          ? 'bg-gray-100 text-gray-600'
                          : i === 2
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-gray-400">
                      {c.plays.toLocaleString()}再生 / 完了率 {pct(c.completion_rate)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-green-600">
                    ¥{c.revenue.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audience Insights */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            オーディエンスインサイト
          </h2>
          {data.audience.new_listeners + data.audience.returning_listeners === 0 ? (
            <p className="text-sm text-gray-400">データがありません</p>
          ) : (
            <div>
              {/* Pie-like display */}
              <div className="flex items-center gap-6 mb-6">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                    {/* Returning (background) */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.91549430918954"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="3"
                    />
                    {/* New listeners arc */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.91549430918954"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                      strokeDasharray={`${audiencePcts.newPct} ${100 - audiencePcts.newPct}`}
                      strokeDashoffset="0"
                    />
                    {/* Returning listeners arc */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.91549430918954"
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="3"
                      strokeDasharray={`${audiencePcts.retPct} ${100 - audiencePcts.retPct}`}
                      strokeDashoffset={`${-audiencePcts.newPct}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-700">
                      {(data.audience.new_listeners + data.audience.returning_listeners).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-sm font-medium">新規リスナー</p>
                      <p className="text-xs text-gray-500">
                        {data.audience.new_listeners.toLocaleString()}人 ({audiencePcts.newPct}%)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500" />
                    <div>
                      <p className="text-sm font-medium">リピーター</p>
                      <p className="text-xs text-gray-500">
                        {data.audience.returning_listeners.toLocaleString()}人 ({audiencePcts.retPct}%)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Horizontal bar breakdown */}
              <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden flex">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${audiencePcts.newPct}%` }}
                />
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${audiencePcts.retPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Completion Rate per Content (Progress Bars) */}
      <div className="card p-6 mb-8">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          コンテンツ別完了率
        </h2>
        {data.content_performance.length === 0 ? (
          <p className="text-sm text-gray-400">データがありません</p>
        ) : (
          <div className="space-y-3">
            {[...data.content_performance]
              .sort((a, b) => b.completion_rate - a.completion_rate)
              .slice(0, 10)
              .map((c) => (
                <div key={c.content_id} className="flex items-center gap-3">
                  <p className="text-sm w-48 truncate flex-shrink-0" title={c.title}>
                    {c.title}
                  </p>
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        c.completion_rate >= 0.7
                          ? 'bg-green-500'
                          : c.completion_rate >= 0.4
                            ? 'bg-yellow-500'
                            : 'bg-red-400'
                      }`}
                      style={{ width: `${Math.round(c.completion_rate * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-14 text-right">{pct(c.completion_rate)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Content Performance Table */}
      <div className="card overflow-hidden mb-8">
        <div className="p-6 border-b">
          <h2 className="font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-600" />
            コンテンツパフォーマンス
          </h2>
        </div>
        {sortedContent.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-gray-400">データがありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {(
                    [
                      { key: 'title' as SortKey, label: 'タイトル' },
                      { key: 'plays' as SortKey, label: '再生数' },
                      { key: 'completions' as SortKey, label: '完了数' },
                      { key: 'completion_rate' as SortKey, label: '完了率' },
                      { key: 'purchases' as SortKey, label: '購入数' },
                      { key: 'revenue' as SortKey, label: '収益' },
                      { key: 'avg_rating' as SortKey, label: '評価' },
                    ] as const
                  ).map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                    >
                      {col.label}
                      {sortIndicator(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedContent.map((c) => (
                  <tr
                    key={c.content_id}
                    onClick={() =>
                      setSelectedContentId(selectedContentId === c.content_id ? null : c.content_id)
                    }
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate">{c.title}</td>
                    <td className="px-4 py-3">{c.plays.toLocaleString()}</td>
                    <td className="px-4 py-3">{c.completions.toLocaleString()}</td>
                    <td className="px-4 py-3">{pct(c.completion_rate)}</td>
                    <td className="px-4 py-3">{c.purchases.toLocaleString()}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">
                      ¥{c.revenue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-500" />
                        {formatRating(c.avg_rating)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Content Detail Panel */}
      {selectedContent && (
        <div className="card p-6 mb-8 border-l-4 border-brand-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{selectedContent.title}</h3>
            <button
              onClick={() => setSelectedContentId(null)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              閉じる
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">再生数</p>
              <p className="text-lg font-bold text-purple-600">
                {selectedContent.plays.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">完了数</p>
              <p className="text-lg font-bold text-blue-600">
                {selectedContent.completions.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">完了率</p>
              <p className="text-lg font-bold text-green-600">
                {pct(selectedContent.completion_rate)}
              </p>
              <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${Math.round(selectedContent.completion_rate * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">購入数</p>
              <p className="text-lg font-bold text-orange-600">
                {selectedContent.purchases.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">収益</p>
              <p className="text-lg font-bold text-green-600">
                ¥{selectedContent.revenue.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">平均評価</p>
              <p className="text-lg font-bold text-yellow-600 flex items-center gap-1">
                <Star className="w-5 h-5 text-yellow-500" />
                {formatRating(selectedContent.avg_rating)}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href={`/content/${selectedContent.content_id}`}
              className="text-sm text-brand-600 hover:underline"
            >
              コンテンツページを見る →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
