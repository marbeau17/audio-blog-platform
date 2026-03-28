'use client';

import { useState, useEffect, useMemo } from 'react';
import { List, ChevronDown, ChevronUp, SkipBack, SkipForward } from 'lucide-react';
import { api } from '@/lib/api';
import type { Chapter } from '@/types';

interface ChapterListProps {
  contentId: string;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ChapterList({ contentId, currentTime, onSeek }: ChapterListProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchChapters() {
      try {
        const res = await api.get<Chapter[]>(`/stream/${contentId}/chapters`);
        if (!cancelled) {
          setChapters(res.data.sort((a, b) => a.order - b.order));
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('チャプターの読み込みに失敗しました');
        }
      }
    }

    fetchChapters();
    return () => { cancelled = true; };
  }, [contentId]);

  const currentChapterIndex = useMemo(() => {
    return chapters.findIndex(
      (ch) => ch.start_seconds <= currentTime && currentTime < ch.end_seconds
    );
  }, [chapters, currentTime]);

  const goToPreviousChapter = () => {
    if (currentChapterIndex > 0) {
      onSeek(chapters[currentChapterIndex - 1].start_seconds);
    } else if (chapters.length > 0) {
      onSeek(chapters[0].start_seconds);
    }
  };

  const goToNextChapter = () => {
    if (currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1) {
      onSeek(chapters[currentChapterIndex + 1].start_seconds);
    }
  };

  if (chapters.length === 0 && !error) return null;

  return (
    <div className="bg-white border-t border-gray-100">
      {/* Toggle button and chapter nav */}
      <div className="flex items-center justify-between px-4 py-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
        >
          <List className="w-4 h-4" />
          <span>チャプター</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {chapters.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousChapter}
              disabled={currentChapterIndex <= 0}
              className="p-1 text-gray-500 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition"
              title="前のチャプター"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={goToNextChapter}
              disabled={currentChapterIndex < 0 || currentChapterIndex >= chapters.length - 1}
              className="p-1 text-gray-500 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed transition"
              title="次のチャプター"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Collapsible chapter list */}
      {isOpen && (
        <div className="max-h-48 overflow-y-auto px-4 pb-2">
          {error ? (
            <p className="text-xs text-red-500 py-2">{error}</p>
          ) : (
            <ul className="space-y-1">
              {chapters.map((chapter, index) => {
                const isCurrent = index === currentChapterIndex;
                return (
                  <li key={chapter.chapter_id}>
                    <button
                      onClick={() => onSeek(chapter.start_seconds)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm transition ${
                        isCurrent
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">
                        {chapter.order}
                      </span>
                      <span className="flex-1 truncate">{chapter.title}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatTimestamp(chapter.start_seconds)} - {formatTimestamp(chapter.end_seconds)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
