'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import type { Content } from '@/types';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Music,
  FileText,
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';

/* ─── constants ──────────────────────────────── */

type StatusFilter = 'all' | 'draft' | 'published' | 'archived';
type SortKey = 'newest' | 'most_plays' | 'most_purchases';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'draft', label: '下書き' },
  { key: 'published', label: '公開中' },
  { key: 'archived', label: 'アーカイブ' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: '新しい順' },
  { key: 'most_plays', label: '再生数順' },
  { key: 'most_purchases', label: '購入数順' },
];

const PAGE_SIZE = 10;

/* ─── helpers ────────────────────────────────── */

function statusBadge(status: string) {
  switch (status) {
    case 'published':
      return <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">公開中</span>;
    case 'draft':
      return <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-600">下書き</span>;
    case 'archived':
      return <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">アーカイブ</span>;
    default:
      return <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-500">{status}</span>;
  }
}

function audioBadge(audioStatus: string) {
  switch (audioStatus) {
    case 'completed':
      return <span className="inline-flex items-center gap-1 text-xs text-green-600"><Music className="w-3 h-3" />完了</span>;
    case 'processing':
    case 'queued':
      return <span className="inline-flex items-center gap-1 text-xs text-blue-600"><Loader2 className="w-3 h-3 animate-spin" />処理中</span>;
    case 'failed':
      return <span className="inline-flex items-center gap-1 text-xs text-red-600"><Music className="w-3 h-3" />失敗</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><FileText className="w-3 h-3" />なし</span>;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function sortContents(contents: Content[], sortKey: SortKey): Content[] {
  const sorted = [...contents];
  switch (sortKey) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'most_plays':
      return sorted.sort((a, b) => b.stats.play_count - a.stats.play_count);
    case 'most_purchases':
      return sorted.sort((a, b) => b.stats.purchase_count - a.stats.purchase_count);
    default:
      return sorted;
  }
}

/* ─── main page ──────────────────────────────── */

export default function CreatorContentPage() {
  const { user } = useAuth();

  /* data */
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  /* filters & sort */
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);

  /* delete */
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* publish toggle busy */
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const markBusy = (id: string) => setBusyIds((s) => new Set(s).add(id));
  const clearBusy = (id: string) =>
    setBusyIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });

  /* ─── fetch ────────────────────────────────── */

  const fetchContents = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<Content[]>(`/contents?creator_id=${user.uid}`);
      setContents(res.data);
    } catch (err: unknown) {
      console.error('Failed to fetch contents:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  /* ─── actions ──────────────────────────────── */

  const handleDelete = async (contentId: string) => {
    setDeleting(true);
    try {
      await api.delete(`/contents/${contentId}`);
      setDeleteTarget(null);
      await fetchContents();
    } catch {
      /* TODO: toast */
    } finally {
      setDeleting(false);
    }
  };

  const togglePublish = async (content: Content) => {
    const newStatus = content.status === 'published' ? 'draft' : 'published';
    markBusy(content.content_id);
    try {
      await api.put(`/contents/${content.content_id}`, {
        status: newStatus,
      });
      await fetchContents();
    } catch {
      /* TODO: toast */
    } finally {
      clearBusy(content.content_id);
    }
  };

  /* ─── derived ──────────────────────────────── */

  const filtered = statusFilter === 'all'
    ? contents
    : contents.filter((c) => c.status === statusFilter);

  const sorted = sortContents(filtered, sortKey);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filter changes
  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  };

  const handleSortChange = (key: SortKey) => {
    setSortKey(key);
    setPage(1);
  };

  /* ─── loading skeleton ─────────────────────── */

  if (loading) {
    return (
      <ProtectedRoute requiredRole="creator">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-2 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 w-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  /* ─── render ───────────────────────────────── */

  return (
    <ProtectedRoute requiredRole="creator">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/creator" className="text-gray-400 hover:text-gray-600 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold">コンテンツ管理</h1>
          </div>
          <Link href="/creator/new" className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            新規作成
          </Link>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex gap-1.5">
            {STATUS_TABS.map((tab) => {
              const count = tab.key === 'all'
                ? contents.length
                : contents.filter((c) => c.status === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleFilterChange(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    statusFilter === tab.key
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 text-xs ${statusFilter === tab.key ? 'text-white/80' : 'text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <select
              value={sortKey}
              onChange={(e) => handleSortChange(e.target.value as SortKey)}
              className="text-sm border rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content table / list */}
        {sorted.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-400 mb-2">No content yet. Create your first content!</p>
            <p className="text-sm text-gray-400 mb-6">まだコンテンツがありません。最初のコンテンツを作成しましょう！</p>
            <Link href="/creator/new" className="btn-primary inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              新規作成
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-3 pr-4 font-medium">タイトル</th>
                    <th className="pb-3 pr-4 font-medium">ステータス</th>
                    <th className="pb-3 pr-4 font-medium">音声</th>
                    <th className="pb-3 pr-4 font-medium text-right">価格</th>
                    <th className="pb-3 pr-4 font-medium text-right">再生数</th>
                    <th className="pb-3 pr-4 font-medium text-right">購入数</th>
                    <th className="pb-3 pr-4 font-medium">作成日</th>
                    <th className="pb-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.map((content) => (
                    <tr key={content.content_id} className="hover:bg-gray-50 transition">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/content/${content.content_id}`}
                          className="text-sm font-medium hover:text-brand-600 transition line-clamp-1"
                        >
                          {content.title}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        {statusBadge(content.status)}
                      </td>
                      <td className="py-3 pr-4">
                        {audioBadge(content.audio.status)}
                      </td>
                      <td className="py-3 pr-4 text-right text-sm">
                        {content.pricing.type === 'free' ? (
                          <span className="text-gray-400">無料</span>
                        ) : (
                          <span className="font-medium">¥{content.pricing.price_jpy.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-sm text-gray-600">
                        {content.stats.play_count.toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-right text-sm text-gray-600">
                        {content.stats.purchase_count.toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-500">
                        {formatDate(content.created_at)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/creator/content/${content.content_id}/edit`}
                            className="p-1.5 text-gray-400 hover:text-brand-600 transition rounded-lg hover:bg-brand-50"
                            title="編集"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => togglePublish(content)}
                            disabled={busyIds.has(content.content_id)}
                            className="p-1.5 text-gray-400 hover:text-brand-600 transition rounded-lg hover:bg-brand-50 disabled:opacity-50"
                            title={content.status === 'published' ? '非公開にする' : '公開する'}
                          >
                            {busyIds.has(content.content_id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : content.status === 'published' ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(content.content_id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {paginated.map((content) => (
                <div key={content.content_id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <Link
                      href={`/content/${content.content_id}`}
                      className="text-sm font-medium hover:text-brand-600 transition line-clamp-2 flex-1"
                    >
                      {content.title}
                    </Link>
                    {statusBadge(content.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    {audioBadge(content.audio.status)}
                    <span>
                      {content.pricing.type === 'free'
                        ? '無料'
                        : `¥${content.pricing.price_jpy.toLocaleString()}`}
                    </span>
                    <span>再生 {content.stats.play_count.toLocaleString()}</span>
                    <span>購入 {content.stats.purchase_count.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{formatDate(content.created_at)}</span>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/creator/content/${content.content_id}/edit`}
                        className="p-1.5 text-gray-400 hover:text-brand-600 transition rounded-lg hover:bg-brand-50"
                        title="編集"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => togglePublish(content)}
                        disabled={busyIds.has(content.content_id)}
                        className="p-1.5 text-gray-400 hover:text-brand-600 transition rounded-lg hover:bg-brand-50 disabled:opacity-50"
                        title={content.status === 'published' ? '非公開にする' : '公開する'}
                      >
                        {busyIds.has(content.content_id) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : content.status === 'published' ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(content.content_id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                        p === safePage
                          ? 'bg-brand-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
              <h2 className="text-lg font-semibold mb-2">コンテンツを削除</h2>
              <p className="text-sm text-gray-600 mb-6">
                このコンテンツを削除しますか？ この操作は取り消せません。
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteTarget(null)} className="btn-secondary">
                  キャンセル
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
