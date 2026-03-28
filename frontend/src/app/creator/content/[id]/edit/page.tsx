'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import type { Content } from '@/types';

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);

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
      setStatus(content.status);
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
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await api.put(`/contents/${contentId}`, {
        title,
        excerpt,
        body_markdown: bodyMarkdown,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        pricing: {
          type: pricingType,
          price_jpy: pricingType === 'paid' ? priceJpy : 0,
          currency: 'JPY',
        },
      });
      setSuccessMessage('保存しました');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存に失敗しました';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    setSaving(true);
    setError('');
    setSuccessMessage('');
    const newStatus = status === 'published' ? 'draft' : 'published';
    try {
      await api.put(`/contents/${contentId}`, { status: newStatus });
      setStatus(newStatus);
      setSuccessMessage(newStatus === 'published' ? '公開しました' : '非公開にしました');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ステータス変更に失敗しました';
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
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status === 'published' ? '公開中' : '下書き'}
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

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? '保存中...' : '保存する'}
            </button>
            <button
              onClick={handleTogglePublish}
              disabled={saving}
              className={status === 'published' ? 'btn-secondary' : 'btn-primary'}
            >
              {saving
                ? '処理中...'
                : status === 'published'
                  ? '非公開にする'
                  : '公開する'}
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
