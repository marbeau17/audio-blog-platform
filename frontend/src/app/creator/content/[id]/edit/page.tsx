'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import type { Content, Category } from '@/types';

export default function EditContentPage() {
  const router = useRouter();
  const params = useParams();
  const contentId = params.id as string;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [pricingType, setPricingType] = useState<'free' | 'paid'>('free');
  const [priceJpy, setPriceJpy] = useState(0);
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('draft');
  const [publishMode, setPublishMode] = useState<'draft' | 'publish' | 'schedule'>('draft');
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [seoOpen, setSeoOpen] = useState(false);

  useEffect(() => {
    api.get<Category[]>('/categories').then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Content>(`/contents/${contentId}`);
      const content = res.data;

      if (user && content.creator_id !== user.uid) {
        setError('このコンテンツの編集権限がありません');
        setLoading(false);
        return;
      }

      setTitle(content.title);
      setExcerpt(content.excerpt);
      setBodyMarkdown(content.body_markdown ?? '');
      setPricingType(content.pricing.type);
      setPriceJpy(content.pricing.price_jpy);
      setTags(content.tags.join(', '));
      setSelectedCategories(content.category_ids ?? []);
      setStatus(content.status);
      if (content.status === 'published') {
        setPublishMode('publish');
      } else if (content.status === 'scheduled') {
        setPublishMode('schedule');
        if (content.scheduled_at) {
          const dt = new Date(content.scheduled_at);
          setScheduledAt(dt.toISOString().slice(0, 16));
        }
      } else {
        setPublishMode('draft');
      }
      setThumbnailUrl(content.thumbnail_url ?? '');
      if (content.seo) {
        setMetaTitle(content.seo.meta_title ?? '');
        setMetaDescription(content.seo.meta_description ?? '');
        setOgImageUrl(content.seo.og_image_url ?? '');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'コンテンツの取得に失敗しました';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [contentId, user]);

  useEffect(() => {
    if (contentId) {
      fetchContent();
    }
  }, [contentId, fetchContent]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }
    if (publishMode === 'schedule' && !scheduledAt) {
      setError('公開予約日時を入力してください');
      return;
    }
    setSaving(true);
    setError('');
    setSuccessMessage('');
    const statusMap = { draft: 'draft', publish: 'published', schedule: 'scheduled' } as const;
    const newStatus = statusMap[publishMode];
    try {
      await api.put(`/contents/${contentId}`, {
        title,
        excerpt,
        body_markdown: bodyMarkdown,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        category_ids: selectedCategories,
        pricing: {
          type: pricingType,
          price_jpy: pricingType === 'paid' ? priceJpy : 0,
          currency: 'JPY',
        },
        thumbnail_url: thumbnailUrl || undefined,
        seo: {
          meta_title: metaTitle || undefined,
          meta_description: metaDescription || undefined,
          og_image_url: ogImageUrl || undefined,
        },
        status: newStatus,
        scheduled_at: publishMode === 'schedule' ? scheduledAt : undefined,
      });
      setStatus(newStatus);
      setSuccessMessage('保存しました');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存に失敗しました';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTtsConvert = async () => {
    setConverting(true);
    try {
      await api.post('/tts/convert', { content_id: contentId, priority: 'high' });
      setSuccessMessage('音声変換を開始しました。完了までお待ちください。');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '音声変換リクエストに失敗しました';
      setError(message);
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/contents/${contentId}`);
      router.push('/creator/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '削除に失敗しました';
      setError(message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="creator">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="creator">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">コンテンツ編集</h1>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                status === 'published'
                  ? 'bg-green-100 text-green-700'
                  : status === 'scheduled'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status === 'published' ? '公開中' : status === 'scheduled' ? '公開予約' : '下書き'}
            </span>
            <Link
              href="/creator/dashboard"
              className="text-sm text-brand-600 hover:underline"
            >
              ダッシュボードに戻る
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-50 text-green-600 text-sm rounded-lg p-3 mb-4">
            {successMessage}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="記事のタイトル"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              概要
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="input-field h-20"
              placeholder="記事の概要（最大500文字）"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              本文（Markdown）
            </label>
            <MarkdownEditor value={bodyMarkdown} onChange={setBodyMarkdown} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タグ（カンマ区切り）
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input-field"
              placeholder="ビジネス, リーダーシップ, 経営"
            />
          </div>

          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ（最大3つ）</label>
              {selectedCategories.length >= 3 && (
                <p className="text-xs text-amber-600 mb-2">カテゴリは最大3つまで選択できます</p>
              )}
              <div className="flex flex-wrap gap-3">
                {categories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (selectedCategories.length < 3) {
                            setSelectedCategories([...selectedCategories, cat.id]);
                          }
                        } else {
                          setSelectedCategories(selectedCategories.filter((id) => id !== cat.id));
                        }
                      }}
                      disabled={!selectedCategories.includes(cat.id) && selectedCategories.length >= 3}
                    />
                    <span className="text-sm">{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              サムネイル画像URL
            </label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              className="input-field"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              販売設定
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="free"
                  checked={pricingType === 'free'}
                  onChange={() => setPricingType('free')}
                />
                <span className="text-sm">無料公開</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="paid"
                  checked={pricingType === 'paid'}
                  onChange={() => setPricingType('paid')}
                />
                <span className="text-sm">有料販売</span>
              </label>
            </div>
            {pricingType === 'paid' && (
              <div className="mt-3">
                <label className="block text-sm text-gray-600 mb-1">
                  価格（円）
                </label>
                <input
                  type="number"
                  value={priceJpy}
                  onChange={(e) => setPriceJpy(Number(e.target.value))}
                  className="input-field w-40"
                  min={100}
                  max={50000}
                  step={100}
                />
              </div>
            )}
          </div>

          {/* SEO設定 (collapsible) */}
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setSeoOpen(!seoOpen)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              <span>SEO設定</span>
              {seoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {seoOpen && (
              <div className="px-4 pb-4 space-y-4 border-t">
                <div className="pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メタタイトル
                  </label>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className="input-field"
                    placeholder="検索結果に表示されるタイトル"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メタディスクリプション
                  </label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))}
                    className="input-field h-20"
                    placeholder="検索結果に表示される説明文（最大160文字）"
                    maxLength={160}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {metaDescription.length} / 160
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OGP画像URL
                  </label>
                  <input
                    type="text"
                    value={ogImageUrl}
                    onChange={(e) => setOgImageUrl(e.target.value)}
                    className="input-field"
                    placeholder="OGP画像URL"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 公開設定 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">公開設定</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="publishMode" checked={publishMode === 'draft'} onChange={() => setPublishMode('draft')} />
                <span className="text-sm">下書き保存</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="publishMode" checked={publishMode === 'publish'} onChange={() => setPublishMode('publish')} />
                <span className="text-sm">今すぐ公開</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="publishMode" checked={publishMode === 'schedule'} onChange={() => setPublishMode('schedule')} />
                <span className="text-sm">公開予約</span>
              </label>
            </div>
            {publishMode === 'schedule' && (
              <div className="mt-3">
                <label className="block text-sm text-gray-600 mb-1">公開日時</label>
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                  className="input-field w-64" />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? '保存中...' : publishMode === 'publish' ? '公開する' : publishMode === 'schedule' ? '予約保存する' : '保存する'}
            </button>
            <button
              onClick={handleTtsConvert}
              disabled={converting}
              className="btn-secondary"
            >
              {converting ? '変換中...' : '音声変換（TTS）'}
            </button>
            <Link
              href={`/creator/content/${contentId}/versions`}
              className="btn-secondary inline-flex items-center"
            >
              バージョン履歴
            </Link>
          </div>

          {/* Delete section */}
          <div className="pt-4 border-t">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                このコンテンツを削除する
              </button>
            ) : (
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-700 mb-3">
                  本当にこのコンテンツを削除しますか？この操作は取り消せません。
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? '削除中...' : '削除する'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-4 py-2 bg-white text-gray-700 text-sm rounded-lg border hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
