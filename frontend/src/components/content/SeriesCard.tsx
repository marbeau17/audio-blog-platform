'use client';

import type { Series } from '@/types';
import { BookOpen, Clock, Eye, EyeOff } from 'lucide-react';

function formatPrice(pricing: Series['pricing']): string {
  if (pricing.type === 'free') return '無料';
  return `¥${pricing.price_jpy.toLocaleString()}`;
}

interface SeriesCardProps {
  series: Series;
  contentCount: number;
  totalDurationSeconds: number;
  onClick: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

export default function SeriesCard({ series, contentCount, totalDurationSeconds, onClick }: SeriesCardProps) {
  return (
    <button
      onClick={onClick}
      className="card hover:shadow-md transition group text-left w-full"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100">
        {series.thumbnail_url ? (
          <img src={series.thumbnail_url} alt={series.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-indigo-100">
            <BookOpen className="w-10 h-10 text-indigo-300" />
          </div>
        )}
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
            series.status === 'published'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-200 text-gray-600'
          }`}
        >
          {series.status === 'published' ? (
            <><Eye className="w-3 h-3" /> 公開中</>
          ) : (
            <><EyeOff className="w-3 h-3" /> 下書き</>
          )}
        </span>
        {/* Price badge */}
        <span
          className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded ${
            series.pricing.type === 'paid'
              ? 'bg-yellow-400 text-yellow-900'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {formatPrice(series.pricing)}
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-brand-600 transition">
          {series.title}
        </h3>
        {series.description && (
          <p className="text-xs text-gray-500 mb-2 line-clamp-2">{series.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {contentCount}件
          </span>
          {totalDurationSeconds > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(totalDurationSeconds)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
