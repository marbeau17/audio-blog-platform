'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';

interface FavoriteButtonProps {
  contentId: string;
  initialFavorited: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export default function FavoriteButton({
  contentId,
  initialFavorited,
  size = 'md',
  className = '',
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    // Optimistic update
    const prev = favorited;
    setFavorited(!prev);
    setLoading(true);

    try {
      if (prev) {
        await api.delete(`/favorites/${contentId}`);
      } else {
        await api.post(`/favorites/${contentId}`);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      // Revert on error
      setFavorited(prev);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={favorited ? 'お気に入りから削除' : 'お気に入りに追加'}
      className={`inline-flex items-center justify-center transition-colors disabled:opacity-50 ${className}`}
    >
      <Heart
        className={`${iconSize} transition-colors ${
          favorited
            ? 'fill-red-500 text-red-500'
            : 'fill-none text-gray-400 hover:text-red-400'
        }`}
      />
    </button>
  );
}
