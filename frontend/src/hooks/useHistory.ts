'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'audio-blog-history';
const MAX_ITEMS = 50;

export interface HistoryItem {
  content_id: string;
  title: string;
  creator_display_name: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  position_seconds: number;
  played_at: string;
}

function readHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return parsed.sort(
      (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime(),
    );
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // Storage full or unavailable
  }
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load on mount
  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const addToHistory = useCallback(
    (item: Omit<HistoryItem, 'played_at'> & { played_at?: string }) => {
      const entry: HistoryItem = {
        ...item,
        played_at: item.played_at || new Date().toISOString(),
      };

      setHistory((prev) => {
        // Remove existing entry for same content, then prepend new one
        const filtered = prev.filter((h) => h.content_id !== entry.content_id);
        const next = [entry, ...filtered].slice(0, MAX_ITEMS);
        writeHistory(next);
        return next;
      });
    },
    [],
  );

  const removeFromHistory = useCallback((contentId: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.content_id !== contentId);
      writeHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const getHistory = useCallback((): HistoryItem[] => {
    return readHistory();
  }, []);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getHistory,
  };
}
