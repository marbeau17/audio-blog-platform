'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function NewContentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [pricingType, setPricingType] = useState<'free' | 'paid'>('free');
  const [priceJpy, setPriceJpy] = useState(0);
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (publish = false) => {
    if (!title.trim()) { setError('タイトルを入力してください'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.post<{ content_id: string }>('/contents', {
        title,
        excerpt,
        body_markdown: bodyMarkdown,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        pricing: { type: pricingType, price_jpy: pricingType === 'paid' ? priceJpy : 0, currency: 'JPY' },
        status: publish ? 'published' : 'draft',
      });
      router.push(`/content/${res.data.content_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存に失敗しました';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTtsConvert = async (contentId: string) => {
    try {
      await api.post('/tts/convert', { content_id: contentId, priority: 'high' });
      alert('音声変換を開始しました。完了までお待ちください。');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '音声変換リクエストに失敗しました';
      alert(message);
    }
  };

  return (
    <ProtectedRoute requiredRole="creator">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">新規コンテンツ作成</h1>
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="input-field" placeholder="記事のタイトル" maxLength={200} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">概要</label>
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)}
              className="input-field h-20" placeholder="記事の概要（最大500文字）" maxLength={500} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">本文（Markdown）</label>
            <textarea value={bodyMarkdown} onChange={(e) => setBodyMarkdown(e.target.value)}
              className="input-field h-96 font-mono text-sm" placeholder="# 見出し&#10;&#10;本文をMarkdownで記述..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タグ（カンマ区切り）</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              className="input-field" placeholder="ビジネス, リーダーシップ, 経営" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">販売設定</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="free" checked={pricingType === 'free'} onChange={() => setPricingType('free')} />
                <span className="text-sm">無料公開</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="paid" checked={pricingType === 'paid'} onChange={() => setPricingType('paid')} />
                <span className="text-sm">有料販売</span>
              </label>
            </div>
            {pricingType === 'paid' && (
              <div className="mt-3">
                <label className="block text-sm text-gray-600 mb-1">価格（円）</label>
                <input type="number" value={priceJpy} onChange={(e) => setPriceJpy(Number(e.target.value))}
                  className="input-field w-40" min={100} max={50000} step={100} />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary">
              {saving ? '保存中...' : '下書き保存'}
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary">
              {saving ? '保存中...' : '公開する'}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
