'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store';
import type { Content } from '@/types';

export type RepeatMode = 'off' | 'one' | 'all';

export interface PlaylistMeta {
  id: string;
  name: string;
  tracks: Content[];
  createdAt: string;
  updatedAt: string;
}

interface QueueState {
  tracks: Content[];
  currentIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  shuffledIndices: number[];
}

const QUEUE_STORAGE_KEY = 'audio-blog-play-queue';
const PLAYLISTS_STORAGE_KEY = 'audio-blog-playlists';

function generateId(): string {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildShuffledIndices(length: number, currentIndex: number): number[] {
  const indices = Array.from({ length }, (_, i) => i).filter((i) => i !== currentIndex);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  // Put current index first so it plays first
  return [currentIndex, ...indices];
}

function loadQueue(): QueueState {
  if (typeof window === 'undefined') {
    return { tracks: [], currentIndex: -1, shuffle: false, repeat: 'off', shuffledIndices: [] };
  }
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        tracks: parsed.tracks ?? [],
        currentIndex: parsed.currentIndex ?? -1,
        shuffle: parsed.shuffle ?? false,
        repeat: (parsed.repeat as RepeatMode) ?? 'off',
        shuffledIndices: parsed.shuffledIndices ?? [],
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { tracks: [], currentIndex: -1, shuffle: false, repeat: 'off', shuffledIndices: [] };
}

function loadPlaylists(): PlaylistMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }
  return [];
}

export function usePlaylist() {
  const [queue, setQueue] = useState<QueueState>(loadQueue);
  const [playlists, setPlaylists] = useState<PlaylistMeta[]>(loadPlaylists);
  const setCurrentContent = useAppStore((s) => s.setCurrentContent);
  const onTrackEndRef = useRef<(() => void) | null>(null);

  // Persist queue to localStorage
  useEffect(() => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  // Persist playlists to localStorage
  useEffect(() => {
    localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists));
  }, [playlists]);

  // Sync current track to the global store
  const playTrackAtIndex = useCallback(
    (index: number, tracks?: Content[]) => {
      const list = tracks ?? queue.tracks;
      if (index >= 0 && index < list.length) {
        setCurrentContent(list[index]);
        setQueue((prev) => ({ ...prev, tracks: tracks ?? prev.tracks, currentIndex: index }));
      }
    },
    [queue.tracks, setCurrentContent],
  );

  // ── Queue operations ──

  const addToQueue = useCallback(
    (content: Content) => {
      setQueue((prev) => {
        const alreadyExists = prev.tracks.some((t) => t.content_id === content.content_id);
        if (alreadyExists) return prev;
        const newTracks = [...prev.tracks, content];
        const newIndex = prev.currentIndex === -1 ? 0 : prev.currentIndex;
        const newState = { ...prev, tracks: newTracks, currentIndex: newIndex };
        if (prev.shuffle) {
          newState.shuffledIndices = buildShuffledIndices(newTracks.length, newIndex);
        }
        // If this is the first track, start playing it
        if (prev.tracks.length === 0) {
          setCurrentContent(content);
        }
        return newState;
      });
    },
    [setCurrentContent],
  );

  const addMultipleToQueue = useCallback(
    (contents: Content[]) => {
      setQueue((prev) => {
        const existingIds = new Set(prev.tracks.map((t) => t.content_id));
        const newItems = contents.filter((c) => !existingIds.has(c.content_id));
        if (newItems.length === 0) return prev;
        const newTracks = [...prev.tracks, ...newItems];
        const newIndex = prev.currentIndex === -1 ? 0 : prev.currentIndex;
        const newState = { ...prev, tracks: newTracks, currentIndex: newIndex };
        if (prev.shuffle) {
          newState.shuffledIndices = buildShuffledIndices(newTracks.length, newIndex);
        }
        if (prev.tracks.length === 0 && newTracks.length > 0) {
          setCurrentContent(newTracks[0]);
        }
        return newState;
      });
    },
    [setCurrentContent],
  );

  const removeFromQueue = useCallback(
    (contentId: string) => {
      setQueue((prev) => {
        const idx = prev.tracks.findIndex((t) => t.content_id === contentId);
        if (idx === -1) return prev;
        const newTracks = prev.tracks.filter((t) => t.content_id !== contentId);
        let newIndex = prev.currentIndex;
        if (newTracks.length === 0) {
          newIndex = -1;
          setCurrentContent(null);
        } else if (idx < prev.currentIndex) {
          newIndex = prev.currentIndex - 1;
        } else if (idx === prev.currentIndex) {
          // Currently playing track removed; play the next one (or wrap to 0)
          newIndex = Math.min(prev.currentIndex, newTracks.length - 1);
          setCurrentContent(newTracks[newIndex]);
        }
        const newState = { ...prev, tracks: newTracks, currentIndex: newIndex };
        if (prev.shuffle && newTracks.length > 0) {
          newState.shuffledIndices = buildShuffledIndices(newTracks.length, newIndex);
        }
        return newState;
      });
    },
    [setCurrentContent],
  );

  const clearQueue = useCallback(() => {
    setQueue({ tracks: [], currentIndex: -1, shuffle: false, repeat: 'off', shuffledIndices: [] });
    setCurrentContent(null);
  }, [setCurrentContent]);

  const moveTrack = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.tracks.length ||
        toIndex < 0 ||
        toIndex >= prev.tracks.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const newTracks = [...prev.tracks];
      const [moved] = newTracks.splice(fromIndex, 1);
      newTracks.splice(toIndex, 0, moved);

      let newIndex = prev.currentIndex;
      if (prev.currentIndex === fromIndex) {
        newIndex = toIndex;
      } else if (fromIndex < prev.currentIndex && toIndex >= prev.currentIndex) {
        newIndex = prev.currentIndex - 1;
      } else if (fromIndex > prev.currentIndex && toIndex <= prev.currentIndex) {
        newIndex = prev.currentIndex + 1;
      }

      return { ...prev, tracks: newTracks, currentIndex: newIndex };
    });
  }, []);

  // ── Navigation ──

  const getNextIndex = useCallback(
    (state: QueueState): number | null => {
      if (state.tracks.length === 0) return null;
      if (state.repeat === 'one') return state.currentIndex;

      if (state.shuffle && state.shuffledIndices.length > 0) {
        const posInShuffle = state.shuffledIndices.indexOf(state.currentIndex);
        const nextPos = posInShuffle + 1;
        if (nextPos < state.shuffledIndices.length) {
          return state.shuffledIndices[nextPos];
        }
        if (state.repeat === 'all') return state.shuffledIndices[0];
        return null;
      }

      const next = state.currentIndex + 1;
      if (next < state.tracks.length) return next;
      if (state.repeat === 'all') return 0;
      return null;
    },
    [],
  );

  const getPrevIndex = useCallback(
    (state: QueueState): number | null => {
      if (state.tracks.length === 0) return null;
      if (state.repeat === 'one') return state.currentIndex;

      if (state.shuffle && state.shuffledIndices.length > 0) {
        const posInShuffle = state.shuffledIndices.indexOf(state.currentIndex);
        const prevPos = posInShuffle - 1;
        if (prevPos >= 0) return state.shuffledIndices[prevPos];
        if (state.repeat === 'all') return state.shuffledIndices[state.shuffledIndices.length - 1];
        return null;
      }

      const prev = state.currentIndex - 1;
      if (prev >= 0) return prev;
      if (state.repeat === 'all') return state.tracks.length - 1;
      return null;
    },
    [],
  );

  const playNext = useCallback(() => {
    setQueue((prev) => {
      const nextIdx = getNextIndex(prev);
      if (nextIdx === null) return prev;
      setCurrentContent(prev.tracks[nextIdx]);
      return { ...prev, currentIndex: nextIdx };
    });
  }, [getNextIndex, setCurrentContent]);

  const playPrevious = useCallback(() => {
    setQueue((prev) => {
      const prevIdx = getPrevIndex(prev);
      if (prevIdx === null) return prev;
      setCurrentContent(prev.tracks[prevIdx]);
      return { ...prev, currentIndex: prevIdx };
    });
  }, [getPrevIndex, setCurrentContent]);

  // Called when current track ends, to auto-advance
  const onTrackEnd = useCallback(() => {
    playNext();
  }, [playNext]);

  // Keep a ref so external code can call the latest version
  onTrackEndRef.current = onTrackEnd;

  // ── Shuffle / Repeat ──

  const toggleShuffle = useCallback(() => {
    setQueue((prev) => {
      const newShuffle = !prev.shuffle;
      return {
        ...prev,
        shuffle: newShuffle,
        shuffledIndices: newShuffle
          ? buildShuffledIndices(prev.tracks.length, prev.currentIndex)
          : [],
      };
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setQueue((prev) => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const currentIdx = modes.indexOf(prev.repeat);
      return { ...prev, repeat: modes[(currentIdx + 1) % modes.length] };
    });
  }, []);

  // ── Playlist CRUD ──

  const createPlaylist = useCallback((name: string, tracks: Content[] = []): PlaylistMeta => {
    const now = new Date().toISOString();
    const playlist: PlaylistMeta = {
      id: generateId(),
      name,
      tracks,
      createdAt: now,
      updatedAt: now,
    };
    setPlaylists((prev) => [...prev, playlist]);
    return playlist;
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePlaylist = useCallback((id: string, updates: Partial<Pick<PlaylistMeta, 'name' | 'tracks'>>) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
      ),
    );
  }, []);

  const addToPlaylist = useCallback((playlistId: string, content: Content) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        if (p.tracks.some((t) => t.content_id === content.content_id)) return p;
        return { ...p, tracks: [...p.tracks, content], updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const removeFromPlaylist = useCallback((playlistId: string, contentId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id !== playlistId) return p;
        return {
          ...p,
          tracks: p.tracks.filter((t) => t.content_id !== contentId),
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const playPlaylist = useCallback(
    (playlist: PlaylistMeta, startIndex: number = 0) => {
      if (playlist.tracks.length === 0) return;
      const newQueue: QueueState = {
        tracks: [...playlist.tracks],
        currentIndex: startIndex,
        shuffle: queue.shuffle,
        repeat: queue.repeat,
        shuffledIndices: queue.shuffle
          ? buildShuffledIndices(playlist.tracks.length, startIndex)
          : [],
      };
      setQueue(newQueue);
      setCurrentContent(playlist.tracks[startIndex]);
    },
    [queue.shuffle, queue.repeat, setCurrentContent],
  );

  return {
    // Queue state
    queue,
    currentTrack: queue.currentIndex >= 0 ? queue.tracks[queue.currentIndex] : null,
    hasNext: getNextIndex(queue) !== null,
    hasPrevious: getPrevIndex(queue) !== null,

    // Queue operations
    addToQueue,
    addMultipleToQueue,
    removeFromQueue,
    clearQueue,
    moveTrack,
    playTrackAtIndex,

    // Navigation
    playNext,
    playPrevious,
    onTrackEnd,

    // Modes
    toggleShuffle,
    cycleRepeat,

    // Playlists
    playlists,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    playPlaylist,
  };
}
