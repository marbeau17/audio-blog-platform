'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import SeriesCard from '@/components/content/SeriesCard';
import type { Series, Content } from '@/types';
import {
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  Eye,
  EyeOff,
  ArrowLeft,
  GripVertical,
  Loader2,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────── */

function totalDuration(contents: Content[]): number {
  return contents.reduce((sum, c) => sum + (c.audio.duration_seconds ?? 0), 0);
}

/* ─── main page ───────────────────────────────── */

export default function CreatorSeriesPage() {
  const { user } = useAuth();

  /* data */
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [allContents, setAllContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  /* expanded series */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* create form */
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPricingType, setCreatePricingType] = useState<'free' | 'paid'>('free');
  const [createPrice, setCreatePrice] = useState(0);
  const [creating, setCreating] = useState(false);

  /* delete confirmation */
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* busy flags per series */
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const markBusy = (id: string) => setBusyIds((s) => new Set(s).add(id));
  const clearBusy = (id: string) =>
    setBusyIds((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });

  /* ─── fetch ──────────────────────────────────── */

  const fetchData = useCallback(async () => {
    try {
      const [seriesRes, contentsRes] = await Promise.all([
        api.get<Series[]>('/creator/series'),
        api.get<Content[]>('/creator/contents'),
      ]);
      setSeriesList(seriesRes.data);
      setAllContents(contentsRes.data);
    } catch {
      /* silently fail – empty state will show */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── actions ────────────────────────────────── */

  const handleCreate = async () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    try {
      await api.post('/creator/series', {
        title: createTitle.trim(),
        description: createDesc.trim(),
        pricing: {
          type: createPricingType,
          price_jpy: createPricingType === 'paid' ? createPrice : 0,
          currency: 'JPY',
        },
      });
      setCreateTitle('');
      setCreateDesc('');
      setCreatePricingType('free');
      setCreatePrice(0);
      setShowCreate(false);
      await fetchData();
    } catch {
      /* TODO: toast */
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (seriesId: string) => {
    setDeleting(true);
    try {
      await api.delete(`/creator/series/${seriesId}`);
      setDeleteTarget(null);
      if (expandedId === seriesId) setExpandedId(null);
      await fetchData();
    } catch {
      /* TODO: toast */
    } finally {
      setDeleting(false);
    }
  };

  const togglePublish = async (series: Series) => {
    const newStatus = series.status === 'published' ? 'draft' : 'published';
    markBusy(series.series_id);
    try {
      await api.put(`/creator/series/${series.series_id}`, {
        ...series,
        status: newStatus,
      });
      await fetchData();
    } catch {
      /* TODO: toast */
    } finally {
      clearBusy(series.series_id);
    }
  };

  const addContent = async (series: Series, contentId: string) => {
    markBusy(series.series_id);
    try {
      await api.put(`/creator/series/${series.series_id}`, {
        ...series,
        content_ids: [...series.content_ids, contentId],
      });
      await fetchData();
    } catch {
      /* TODO: toast */
    } finally {
      clearBusy(series.series_id);
    }
  };

  const removeContent = async (series: Series, contentId: string) => {
    markBusy(series.series_id);
    try {
      await api.put(`/creator/series/${series.series_id}`, {
        ...series,
        content_ids: series.content_ids.filter((id) => id !== contentId),
      });
      await fetchData();
    } catch {
      /* TODO: toast */
    } finally {
      clearBusy(series.series_id);
    }
  };

  const reorderContent = async (series: Series, index: number, direction: 'up' | 'down') => {
    const ids = [...series.content_ids];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ids.length) return;
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    markBusy(series.series_id);
    try {
      await api.put(`/creator/series/${series.series_id}`, {
        ...series,
        content_ids: ids,
      });
      await fetchData();
    } catch {
      /* TODO: toast */
    } finally {
      clearBusy(series.series_id);
    }
  };

  const updatePricing = async (series: Series, type: 'free' | 'paid', price: number) => {
    markBusy(series.series_id);
    try {
      await api.put(`/creator/series/${series.series_id}`, {
        ...series,
        pricing: { type, price_jpy: type === 'paid' ? price : 0, currency: 'JPY' },
      });
      await fetchData();
    } catch {
      /* TODO: toast */
    } finally {
      clearBusy(series.series_id);
    }
  };

  /* ─── derived ────────────────────────────────── */

  const contentMap = new Map(allContents.map((c) => [c.content_id, c]));

  const expandedSeries = seriesList.find((s) => s.series_id === expandedId) ?? null;
  const expandedContents = expandedSeries
    ? expandedSeries.content_ids.map((id) => contentMap.get(id)).filter(Boolean) as Content[]
    : [];
  const availableContents = expandedSeries
    ? allContents.filter((c) => !expandedSeries.content_ids.includes(c.content_id))
    : [];

  /* ─── render ─────────────────────────────────── */

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/creator" className="text-gray-400 hover:text-gray-600 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">シリーズ管理</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          新規シリーズ
        </button>
      </div>

      {/* ─── Create Form Modal ─────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">新規シリーズ作成</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="シリーズタイトルを入力"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <textarea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="シリーズの説明（任意）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">価格設定</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      checked={createPricingType === 'free'}
                      onChange={() => setCreatePricingType('free')}
                    />
                    無料
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      checked={createPricingType === 'paid'}
                      onChange={() => setCreatePricingType('paid')}
                    />
                    有料
                  </label>
                </div>
                {createPricingType === 'paid' && (
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-sm text-gray-500">¥</span>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={createPrice}
                      onChange={(e) => setCreatePrice(Number(e.target.value))}
                      className="w-32 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="btn-secondary"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createTitle.trim()}
                className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold mb-2">シリーズを削除</h2>
            <p className="text-sm text-gray-600 mb-6">
              このシリーズを削除しますか？ この操作は取り消せません。シリーズ内のコンテンツは削除されません。
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

      {/* ─── Series Grid / Expanded View ───────── */}
      {expandedSeries ? (
        <ExpandedSeriesView
          series={expandedSeries}
          contents={expandedContents}
          availableContents={availableContents}
          busy={busyIds.has(expandedSeries.series_id)}
          onClose={() => setExpandedId(null)}
          onTogglePublish={() => togglePublish(expandedSeries)}
          onDelete={() => setDeleteTarget(expandedSeries.series_id)}
          onAddContent={(contentId) => addContent(expandedSeries, contentId)}
          onRemoveContent={(contentId) => removeContent(expandedSeries, contentId)}
          onReorder={(index, dir) => reorderContent(expandedSeries, index, dir)}
          onUpdatePricing={(type, price) => updatePricing(expandedSeries, type, price)}
        />
      ) : seriesList.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">シリーズがまだありません</p>
          <p className="text-sm">「新規シリーズ」ボタンから最初のシリーズを作成しましょう</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {seriesList.map((s) => {
            const contents = s.content_ids
              .map((id) => contentMap.get(id))
              .filter(Boolean) as Content[];
            return (
              <SeriesCard
                key={s.series_id}
                series={s}
                contentCount={contents.length}
                totalDurationSeconds={totalDuration(contents)}
                onClick={() => setExpandedId(s.series_id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Expanded Series Detail ──────────────────── */

interface ExpandedSeriesViewProps {
  series: Series;
  contents: Content[];
  availableContents: Content[];
  busy: boolean;
  onClose: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  onAddContent: (contentId: string) => void;
  onRemoveContent: (contentId: string) => void;
  onReorder: (index: number, direction: 'up' | 'down') => void;
  onUpdatePricing: (type: 'free' | 'paid', price: number) => void;
}

function ExpandedSeriesView({
  series,
  contents,
  availableContents,
  busy,
  onClose,
  onTogglePublish,
  onDelete,
  onAddContent,
  onRemoveContent,
  onReorder,
  onUpdatePricing,
}: ExpandedSeriesViewProps) {
  const [pricingType, setPricingType] = useState(series.pricing.type);
  const [priceJpy, setPriceJpy] = useState(series.pricing.price_jpy);
  const [pricingDirty, setPricingDirty] = useState(false);

  const handlePricingTypeChange = (t: 'free' | 'paid') => {
    setPricingType(t);
    setPricingDirty(true);
  };

  const handlePriceChange = (v: number) => {
    setPriceJpy(v);
    setPricingDirty(true);
  };

  const savePricing = () => {
    onUpdatePricing(pricingType, priceJpy);
    setPricingDirty(false);
  };

  return (
    <div>
      {/* Back button + title */}
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition">
        <ArrowLeft className="w-4 h-4" />
        シリーズ一覧に戻る
      </button>

      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold truncate">{series.title}</h2>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  series.status === 'published'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {series.status === 'published' ? '公開中' : '下書き'}
              </span>
            </div>
            {series.description && (
              <p className="text-sm text-gray-500">{series.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onTogglePublish}
              disabled={busy}
              className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              {series.status === 'published' ? (
                <><EyeOff className="w-4 h-4" /> 非公開にする</>
              ) : (
                <><Eye className="w-4 h-4" /> 公開する</>
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-500 transition rounded-lg hover:bg-red-50"
              title="削除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: content list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-sm text-gray-700">
            コンテンツ ({contents.length}件)
          </h3>

          {contents.length === 0 ? (
            <div className="card p-8 text-center text-gray-400 text-sm">
              コンテンツがまだ追加されていません
            </div>
          ) : (
            <div className="space-y-2">
              {contents.map((content, index) => (
                <div
                  key={content.content_id}
                  className="card px-4 py-3 flex items-center gap-3"
                >
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                  <span className="text-sm font-medium text-gray-400 w-6 text-right shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{content.title}</p>
                    {content.audio.duration_seconds && (
                      <p className="text-xs text-gray-400">
                        {Math.floor(content.audio.duration_seconds / 60)}分
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onReorder(index, 'up')}
                      disabled={index === 0 || busy}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition"
                      title="上に移動"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onReorder(index, 'down')}
                      disabled={index === contents.length - 1 || busy}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition"
                      title="下に移動"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRemoveContent(content.content_id)}
                      disabled={busy}
                      className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 transition ml-1"
                      title="シリーズから除外"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add content */}
          {availableContents.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2 mt-6">コンテンツを追加</h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {availableContents.map((c) => (
                  <button
                    key={c.content_id}
                    onClick={() => onAddContent(c.content_id)}
                    disabled={busy}
                    className="w-full text-left card px-4 py-2.5 flex items-center gap-3 hover:bg-brand-50 transition disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 text-brand-500 shrink-0" />
                    <span className="text-sm truncate flex-1">{c.title}</span>
                    {c.audio.duration_seconds && (
                      <span className="text-xs text-gray-400 shrink-0">
                        {Math.floor(c.audio.duration_seconds / 60)}分
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: pricing settings */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-gray-700">価格設定</h3>
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={pricingType === 'free'}
                  onChange={() => handlePricingTypeChange('free')}
                />
                無料
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={pricingType === 'paid'}
                  onChange={() => handlePricingTypeChange('paid')}
                />
                バンドル価格
              </label>
            </div>
            {pricingType === 'paid' && (
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">¥</span>
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={priceJpy}
                  onChange={(e) => handlePriceChange(Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
            {pricingDirty && (
              <button
                onClick={savePricing}
                disabled={busy}
                className="btn-primary w-full text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                価格を保存
              </button>
            )}
          </div>

          {/* Info */}
          <div className="card p-4 text-xs text-gray-500 space-y-1">
            <p>作成日: {new Date(series.created_at).toLocaleDateString('ja-JP')}</p>
            <p>更新日: {new Date(series.updated_at).toLocaleDateString('ja-JP')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
