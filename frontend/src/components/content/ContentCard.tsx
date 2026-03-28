'use client';

import Link from 'next/link';
import { ListPlus } from 'lucide-react';
import type { Content } from '@/types';
import { useAppStore } from '@/store';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

export default function ContentCard({ content }: { content: Content }) {
  const setCurrentContent = useAppStore((s) => s.setCurrentContent);

  return (
    <div className="card hover:shadow-md transition group">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100">
        {content.thumbnail_url ? (
          <img src={content.thumbnail_url} alt={content.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
            <span className="text-4xl">🎧</span>
          </div>
        )}
        {content.audio.status === 'completed' && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
            <button
              title="キューに追加"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('queue:add', { detail: content }));
              }}
              className="w-8 h-8 bg-white/90 text-gray-700 hover:bg-white hover:text-brand-600 rounded-full flex items-center justify-center shadow-lg transition"
            >
              <ListPlus className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setCurrentContent(content); }}
              className="w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg transition hover:bg-brand-700"
            >
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        )}
        {content.pricing.type === 'paid' && (
          <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded">
            ¥{content.pricing.price_jpy.toLocaleString()}
          </span>
        )}
        {content.pricing.type === 'free' && (
          <span className="absolute top-2 left-2 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
            無料
          </span>
        )}
      </div>

      <Link href={`/content/${content.content_id}`} className="block p-4">
        <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-brand-600 transition">
          {content.title}
        </h3>
        <p className="text-xs text-gray-500 mb-2">{content.creator_display_name}</p>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {content.audio.duration_seconds && (
            <span>🎧 {formatDuration(content.audio.duration_seconds)}</span>
          )}
          {content.stats.play_count > 0 && <span>▶ {content.stats.play_count.toLocaleString()}</span>}
          {content.stats.average_rating > 0 && <span>★ {content.stats.average_rating.toFixed(1)}</span>}
        </div>
      </Link>
    </div>
  );
}
