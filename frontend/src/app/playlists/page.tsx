'use client';

import { useState } from 'react';
import {
  Plus,
  Trash2,
  Play,
  Music,
  Clock,
  ListMusic,
  MoreVertical,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { usePlaylist } from '@/hooks/usePlaylist';
import type { PlaylistMeta } from '@/hooks/usePlaylist';

function formatTotalDuration(tracks: PlaylistMeta['tracks']): string {
  const totalSeconds = tracks.reduce(
    (sum, t) => sum + (t.audio.duration_seconds ?? 0),
    0,
  );
  if (totalSeconds === 0) return '0 min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

export default function PlaylistsPage() {
  const {
    playlists,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    playPlaylist,
  } = usePlaylist();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createPlaylist(name);
    setNewName('');
    setIsCreating(false);
  };

  const handleRename = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    updatePlaylist(id, { name });
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (id: string) => {
    deletePlaylist(id);
    setDeleteConfirmId(null);
    setMenuOpenId(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Playlists</h1>
          <p className="text-sm text-gray-500 mt-1">
            {playlists.length} playlist{playlists.length !== 1 ? 's' : ''}
          </p>
        </div>

        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Playlist
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewName('');
                }
              }}
              placeholder="Playlist name..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewName('');
              }}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Playlist list */}
      {playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <ListMusic className="w-16 h-16 mb-4" />
          <p className="text-lg font-medium text-gray-500">No playlists yet</p>
          <p className="text-sm mt-1">Create a playlist to organize your favorite audio content</p>
          <button
            onClick={() => setIsCreating(true)}
            className="mt-6 flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create your first playlist
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition group"
            >
              <div className="flex items-start gap-4">
                {/* Playlist icon / thumbnail grid */}
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center flex-shrink-0">
                  {playlist.tracks.length > 0 && playlist.tracks[0].thumbnail_url ? (
                    <img
                      src={playlist.tracks[0].thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <ListMusic className="w-7 h-7 text-brand-500" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {editingId === playlist.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(playlist.id);
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditName('');
                          }
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(playlist.id)}
                        className="p-1 text-brand-600 hover:text-brand-700"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditName('');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {playlist.name}
                    </h3>
                  )}

                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Music className="w-3.5 h-3.5" />
                      {playlist.tracks.length} track{playlist.tracks.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTotalDuration(playlist.tracks)}
                    </span>
                  </div>

                  {/* Track preview */}
                  {playlist.tracks.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {playlist.tracks.slice(0, 5).map((track) => (
                        <span
                          key={track.content_id}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[140px]"
                        >
                          {track.title}
                        </span>
                      ))}
                      {playlist.tracks.length > 5 && (
                        <span className="text-xs text-gray-400">
                          +{playlist.tracks.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {playlist.tracks.length > 0 && (
                    <button
                      onClick={() => playPlaylist(playlist)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium"
                      title="Play playlist"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Play
                    </button>
                  )}

                  {/* More menu */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setMenuOpenId(menuOpenId === playlist.id ? null : playlist.id)
                      }
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg opacity-0 group-hover:opacity-100 transition"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {menuOpenId === playlist.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuOpenId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                          <button
                            onClick={() => {
                              setEditingId(playlist.id);
                              setEditName(playlist.name);
                              setMenuOpenId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Rename
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirmId(playlist.id);
                              setMenuOpenId(null);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Delete confirmation */}
              {deleteConfirmId === playlist.id && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-red-700">
                    Delete &quot;{playlist.name}&quot;? This cannot be undone.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(playlist.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1 bg-white text-gray-600 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
