'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Content, PlaybackPosition } from '@/types';

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAudioPlayer(content: Content | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,
    volume: 1.0,
    isMuted: false,
    isLoading: false,
    error: null,
  });

  // Load audio source via signed URL
  const loadAudio = useCallback(async () => {
    if (!content?.content_id || content.audio.status !== 'completed') return;

    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await api.get<{ url: string }>(`/stream/${content.content_id}/url`);
      if (audioRef.current) {
        audioRef.current.src = res.data.url;
        audioRef.current.load();
      }

      // Restore playback position
      const posRes = await api.get<PlaybackPosition>(`/stream/${content.content_id}/position`);
      const pos = posRes.data;
      if (pos.position_seconds > 0 && pos.total_duration_seconds > 0) {
        const ratio = pos.position_seconds / pos.total_duration_seconds;
        if (ratio < 0.98) {
          // Resume 2 seconds before saved position
          const resumeAt = Math.max(0, pos.position_seconds - 2);
          if (audioRef.current) audioRef.current.currentTime = resumeAt;
        }
      }
      setState((s) => ({ ...s, playbackRate: pos.playback_speed || 1.0 }));

      // Set up Media Session API for background playback
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: content.title,
          artist: content.creator_display_name || 'AudioBlog',
          album: 'AudioBlog',
          artwork: content.thumbnail_url ? [
            { src: content.thumbnail_url, sizes: '512x512', type: 'image/jpeg' }
          ] : [],
        });

        navigator.mediaSession.setActionHandler('play', () => play());
        navigator.mediaSession.setActionHandler('pause', () => pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => skipBack(10));
        navigator.mediaSession.setActionHandler('seekforward', () => skipForward(30));
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load audio';
      setState((s) => ({ ...s, error: message }));
    } finally {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [content]);

  // Save position every 5 seconds
  const savePosition = useCallback(async () => {
    if (!content?.content_id || !audioRef.current) return;
    const audio = audioRef.current;
    if (audio.duration <= 0) return;

    try {
      await api.put(`/stream/${content.content_id}/position`, {
        position_seconds: audio.currentTime,
        total_duration_seconds: audio.duration,
        playback_speed: audio.playbackRate,
        device_id: 'web_browser',
      });
    } catch (err: unknown) {
      console.error('Operation failed:', err);
    }
  }, [content]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
    });
    audio.addEventListener('loadedmetadata', () => {
      setState((s) => ({ ...s, duration: audio.duration, isLoading: false }));
    });
    audio.addEventListener('ended', () => {
      setState((s) => ({ ...s, isPlaying: false }));
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      savePosition();
      api.post(`/stream/${content?.content_id}/play-event`, {
        event_type: 'complete',
        position_seconds: audio.currentTime,
      }).catch((err: unknown) => { console.error('Operation failed:', err); });
    });
    audio.addEventListener('error', () => {
      setState((s) => ({ ...s, error: 'Audio playback error', isLoading: false }));
    });

    return () => {
      audio.pause();
      audio.src = '';
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    loadAudio();
  }, [loadAudio]);

  // Auto-save position every 5 seconds while playing
  useEffect(() => {
    if (state.isPlaying) {
      saveIntervalRef.current = setInterval(savePosition, 5000);
    } else {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    }
    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, [state.isPlaying, savePosition]);

  // Save on page unload
  useEffect(() => {
    const handleUnload = () => savePosition();
    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') savePosition();
    });
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [savePosition]);

  const play = () => {
    audioRef.current?.play();
    setState((s) => ({ ...s, isPlaying: true }));
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  };

  const pause = () => {
    audioRef.current?.pause();
    setState((s) => ({ ...s, isPlaying: false }));
    savePosition();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState((s) => ({ ...s, currentTime: time }));
    }
  };

  const skipBack = (seconds: number = 10) => {
    if (audioRef.current) seek(Math.max(0, audioRef.current.currentTime - seconds));
  };

  const skipForward = (seconds: number = 30) => {
    if (audioRef.current) seek(Math.min(state.duration, audioRef.current.currentTime + seconds));
  };

  const setPlaybackRate = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      setState((s) => ({ ...s, playbackRate: rate }));
    }
  };

  const setVolume = (vol: number) => {
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setState((s) => ({ ...s, volume: vol, isMuted: vol === 0 }));
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setState((s) => ({ ...s, isMuted: !s.isMuted }));
    }
  };

  return {
    state,
    play,
    pause,
    seek,
    skipBack,
    skipForward,
    setPlaybackRate,
    setVolume,
    toggleMute,
  };
}
