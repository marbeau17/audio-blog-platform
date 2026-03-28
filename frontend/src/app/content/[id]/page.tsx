'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store';
import type { Content } from '@/types';
import PaymentButton from '@/components/payment/PaymentButton';

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const setCurrentContent = useAppStore((s) => s.setCurrentContent);
  const [content, setContent] = useState<Content | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await api.get<Content>(`/contents/${id}`);
        setContent(res.data);
        if (user && res.data.pricing.type === 'paid') {
          const purchaseRes = await api.get<{ purchased: boolean }>(`/payment/purchases/${id}/check`);
          setPurchased(purchaseRes.data.purchased);
        }
      } catch (err: unknown) { console.error('Operation failed:', err); }
      finally { setLoading(false); }
    })();
  }, [id, user]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8"><div className="h-64 bg-gray-100 rounded-xl animate-pulse" /></div>;
  if (!content) return <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500">コンテンツが見つかりません</div>;

  const canAccess = content.pricing.type === 'free' || purchased || content.creator_id === user?.uid;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        {content.thumbnail_url && (
          <img src={content.thumbnail_url} alt={content.title} className="w-full aspect-video object-cover rounded-xl mb-6" />
        )}
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{content.title}</h1>
            <p className="text-gray-500 text-sm mb-2">{content.creator_display_name}</p>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {content.stats.play_count > 0 && <span>▶ {content.stats.play_count.toLocaleString()} 再生</span>}
              {content.stats.average_rating > 0 && <span>★ {content.stats.average_rating.toFixed(1)} ({content.stats.review_count}件)</span>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {content.audio.status === 'completed' && canAccess && (
              <button onClick={() => setCurrentContent(content)} className="btn-primary flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                再生
              </button>
            )}
            {content.pricing.type === 'paid' && !purchased && content.creator_id !== user?.uid && (
              <PaymentButton contentId={content.content_id} price={content.pricing.price_jpy} onSuccess={() => setPurchased(true)} />
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      {content.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {content.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">#{tag}</span>
          ))}
        </div>
      )}

      {/* Excerpt */}
      <p className="text-gray-600 mb-6">{content.excerpt}</p>

      {/* Body */}
      {canAccess && content.body_html ? (
        <article className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: content.body_html }} />
      ) : content.pricing.type === 'paid' && !purchased ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <p className="text-gray-500 mb-4">この記事の全文を読むには購入が必要です</p>
          <p className="text-2xl font-bold text-brand-700 mb-4">¥{content.pricing.price_jpy.toLocaleString()}</p>
          <PaymentButton contentId={content.content_id} price={content.pricing.price_jpy} onSuccess={() => setPurchased(true)} />
        </div>
      ) : null}
    </div>
  );
}
