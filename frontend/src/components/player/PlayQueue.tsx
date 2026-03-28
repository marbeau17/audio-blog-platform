'use client';

import { useState } from 'react';
import {
  X,
  Trash2,
  ListMusic,
  Shuffle,
  Repeat,
  Repeat1,
  ChevronUp,
  ChevronDown,
  Music,
  GripVertical,
} from 'lucide-react';
import type { Content } from '@/types';
import type { RepeatMode } from '@/hooks/usePlaylist';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PlayQueueProps {
  tracks: Content[];
  currentIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  onPlayTrack: (index: number) => void;
  onRemoveTrack: (contentId: string) => void;
  onMoveTrack: (from: number, to: number) => void;
  onClearQueue: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
}

export default function PlayQueue({
  tracks,
  currentIndex,
  shuffle,
  repeat,
  onPlayTrack,
  onRemoveTrack,
  onMoveTrack,
  onClearQueue,
  onToggleShuffle,
  onCycleRepeat,
}: PlayQueueProps) {
  const [isOpen, setIsOpen] = useState(false);

  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-900 relative"
        title="Play Queue"
      >
        <ListMusic className="w-5 h-5" />
        {tracks.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {tracks.length}
          </span>
        )}
      </button>

      {/* Slide-up panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Play Queue
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {tracks.length} tracks
                </span>
              </h3>

              <div className="flex items-center gap-1">
                {/* Shuffle toggle */}
                <button
                  onClick={onToggleShuffle}
                  className={`p-2 rounded-lg transition ${
                    shuffle
                      ? 'text-brand-600 bg-brand-50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title={`Shuffle: ${shuffle ? 'On' : 'Off'}`}
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                {/* Repeat toggle */}
                <button
                  onClick={onCycleRepeat}
                  className={`p-2 rounded-lg transition ${
                    repeat !== 'off'
                      ? 'text-brand-600 bg-brand-50'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title={`Repeat: ${repeat}`}
                >
                  <RepeatIcon className="w-4 h-4" />
                </button>

                {/* Clear queue */}
                {tracks.length > 0 && (
                  <button
                    onClick={() => {
                      onClearQueue();
                      setIsOpen(false);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition"
                    title="Clear Queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* Close */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Track list */}
            <div className="flex-1 overflow-y-auto">
              {tracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Music className="w-12 h-12 mb-3" />
                  <p className="text-sm">Queue is empty</p>
                  <p className="text-xs mt-1">Add tracks to start listening</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {tracks.map((track, index) => {
                    const isCurrent = index === currentIndex;
                    return (
                      <li
                        key={track.content_id}
                        className={`flex items-center gap-3 px-4 py-3 group transition ${
                          isCurrent
                            ? 'bg-brand-50 border-l-4 border-brand-600'
                            : 'hover:bg-gray-50 border-l-4 border-transparent'
                        }`}
                      >
                        {/* Drag handle (visual) + reorder buttons */}
                        <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => onMoveTrack(index, Math.max(0, index - 1))}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move up"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <GripVertical className="w-3 h-3 text-gray-300" />
                          <button
                            onClick={() => onMoveTrack(index, Math.min(tracks.length - 1, index + 1))}
                            disabled={index === tracks.length - 1}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            title="Move down"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Track number / playing indicator */}
                        <div className="w-6 text-center flex-shrink-0">
                          {isCurrent ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <span className="w-0.5 h-3 bg-brand-600 rounded-full animate-pulse" />
                              <span className="w-0.5 h-4 bg-brand-600 rounded-full animate-pulse delay-75" />
                              <span className="w-0.5 h-2 bg-brand-600 rounded-full animate-pulse delay-150" />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">{index + 1}</span>
                          )}
                        </div>

                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                          {track.thumbnail_url ? (
                            <img
                              src={track.thumbnail_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                        </div>

                        {/* Track info (clickable) */}
                        <button
                          onClick={() => onPlayTrack(index)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <p
                            className={`text-sm truncate ${
                              isCurrent ? 'font-semibold text-brand-700' : 'font-medium text-gray-900'
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {track.creator_display_name}
                          </p>
                        </button>

                        {/* Duration */}
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatDuration(track.audio.duration_seconds)}
                        </span>

                        {/* Remove button */}
                        <button
                          onClick={() => onRemoveTrack(track.content_id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                          title="Remove from queue"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
