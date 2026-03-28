'use client';

import { useState } from 'react';
import { SkipBack, SkipForward, List } from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { usePlaylist } from '@/hooks/usePlaylist';
import { useAppStore } from '@/store';
import ChapterList from './ChapterList';
import PlayQueue from './PlayQueue';

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer() {
  const content = useAppStore((s) => s.currentContent);
  const isVisible = useAppStore((s) => s.isPlayerVisible);
  const { state, play, pause, seek, skipBack, skipForward, setPlaybackRate, setVolume, toggleMute } =
    useAudioPlayer(content);
  const {
    queue,
    hasNext,
    hasPrevious,
    playNext,
    playPrevious,
    playTrackAtIndex,
    removeFromQueue,
    moveTrack,
    clearQueue,
    toggleShuffle,
    cycleRepeat,
  } = usePlaylist();
  const [showQueue, setShowQueue] = useState(false);

  if (!isVisible || !content) return null;

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      {/* Progress bar */}
      <div
        className="h-1 bg-gray-200 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          seek(ratio * state.duration);
        }}
      >
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-center gap-4 px-4 py-3 max-w-7xl mx-auto">
        {/* Content info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{content.title}</p>
          <p className="text-xs text-gray-500 truncate">{content.creator_display_name}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={playPrevious}
            disabled={!hasPrevious}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            title="前のトラック"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button onClick={() => skipBack(10)} className="p-2 text-gray-600 hover:text-gray-900" title="10秒戻る">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          <button
            onClick={() => (state.isPlaying ? pause() : play())}
            className="p-3 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition"
          >
            {state.isLoading ? (
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : state.isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button onClick={() => skipForward(30)} className="p-2 text-gray-600 hover:text-gray-900" title="30秒進む">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>

          <button
            onClick={playNext}
            disabled={!hasNext}
            className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            title="次のトラック"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Time */}
        <div className="text-xs text-gray-500 w-24 text-center">
          {formatTime(state.currentTime)} / {formatTime(state.duration)}
        </div>

        {/* Speed */}
        <select
          value={state.playbackRate}
          onChange={(e) => setPlaybackRate(Number(e.target.value))}
          className="text-xs bg-gray-100 border border-gray-300 rounded px-2 py-1"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>{s}x</option>
          ))}
        </select>

        {/* Volume */}
        <button onClick={toggleMute} className="p-2 text-gray-600 hover:text-gray-900">
          {state.isMuted ? '🔇' : '🔊'}
        </button>

        {/* Queue toggle */}
        <button
          onClick={() => setShowQueue((prev) => !prev)}
          className={`p-2 rounded transition ${showQueue ? 'text-brand-600 bg-brand-50' : 'text-gray-600 hover:text-gray-900'}`}
          title="再生キュー"
        >
          <List className="w-5 h-5" />
        </button>
      </div>

      {/* Play queue */}
      {showQueue && (
        <PlayQueue
          tracks={queue.tracks}
          currentIndex={queue.currentIndex}
          shuffle={queue.shuffle}
          repeat={queue.repeat}
          onPlayTrack={playTrackAtIndex}
          onRemoveTrack={removeFromQueue}
          onMoveTrack={moveTrack}
          onClearQueue={clearQueue}
          onToggleShuffle={toggleShuffle}
          onCycleRepeat={cycleRepeat}
        />
      )}

      {/* Chapter list */}
      <ChapterList
        contentId={content.content_id}
        currentTime={state.currentTime}
        onSeek={seek}
      />

      {/* Error */}
      {state.error && (
        <div className="bg-red-50 text-red-600 text-xs px-4 py-1 text-center">{state.error}</div>
      )}
    </div>
  );
}
