'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Edit2, Trash2, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

/* ─── Types ─────────────────────────────────────── */

interface Review {
  review_id: string;
  content_id: string;
  user_id: string;
  user_display_name: string;
  user_avatar_url: string | null;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
}

interface ReviewsResponse {
  reviews: Review[];
  average_rating: number;
  total_count: number;
  has_more: boolean;
  cursor: string | null;
}

type SortOption = 'newest' | 'highest' | 'lowest';

/* ─── Star Rating Display ───────────────────────── */

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={
            i <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-none text-gray-300'
          }
        />
      ))}
    </span>
  );
}

/* ─── Interactive Star Selector ─────────────────── */

function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none transition-transform hover:scale-110"
          aria-label={`${i}星`}
        >
          <Star
            size={24}
            className={
              i <= (hover || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-gray-300'
            }
          />
        </button>
      ))}
    </span>
  );
}

/* ─── Review Item ───────────────────────────────── */

function ReviewItem({
  review,
  isOwn,
  onEdit,
  onDelete,
}: {
  review: Review;
  isOwn: boolean;
  onEdit: (review: Review) => void;
  onDelete: (reviewId: string) => void;
}) {
  const formattedDate = new Date(review.created_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="border-b border-gray-100 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {review.user_avatar_url ? (
            <img
              src={review.user_avatar_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-500 text-xs font-bold">
              {review.user_display_name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {review.user_display_name}
            </p>
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} size={14} />
              <span className="text-xs text-gray-400">{formattedDate}</span>
            </div>
          </div>
        </div>

        {isOwn && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(review)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="編集"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onDelete(review.review_id)}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
              aria-label="削除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {review.comment && (
        <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
          {review.comment}
        </p>
      )}
    </div>
  );
}

/* ─── Main ReviewSection ────────────────────────── */

export default function ReviewSection({ contentId }: { contentId: string }) {
  const { user } = useAuth();

  // Data
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');

  // Edit state
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Error
  const [error, setError] = useState('');

  const myReview = user
    ? reviews.find((r) => r.user_id === user.uid)
    : undefined;

  /* ── Fetch reviews ── */

  const fetchReviews = useCallback(
    async (append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const params = new URLSearchParams({ sort: sortBy, limit: '10' });
        if (append && cursor) params.set('cursor', cursor);

        const res = await api.get<ReviewsResponse>(
          `/contents/${contentId}/reviews?${params.toString()}`
        );
        const data = res.data;

        setReviews((prev) => (append ? [...prev, ...data.reviews] : data.reviews));
        setAverageRating(data.average_rating);
        setTotalCount(data.total_count);
        setHasMore(data.has_more);
        setCursor(data.cursor);
      } catch {
        setError('レビューの読み込みに失敗しました');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [contentId, sortBy, cursor]
  );

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, sortBy]);

  /* ── Submit new review ── */

  const handleSubmit = async () => {
    if (newRating === 0) {
      setError('評価を選択してください');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post<Review>(`/contents/${contentId}/reviews`, {
        rating: newRating,
        comment: newComment.trim(),
      });
      setReviews((prev) => [res.data, ...prev]);
      setTotalCount((c) => c + 1);
      setNewRating(0);
      setNewComment('');
    } catch {
      setError('レビューの投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Edit review ── */

  const startEdit = (review: Review) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment);
  };

  const cancelEdit = () => {
    setEditingReview(null);
    setEditRating(0);
    setEditComment('');
  };

  const handleUpdate = async () => {
    if (!editingReview || editRating === 0) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await api.put<Review>(
        `/contents/${contentId}/reviews/${editingReview.review_id}`,
        { rating: editRating, comment: editComment.trim() }
      );
      setReviews((prev) =>
        prev.map((r) => (r.review_id === editingReview.review_id ? res.data : r))
      );
      cancelEdit();
    } catch {
      setError('レビューの更新に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete review ── */

  const confirmDelete = (reviewId: string) => {
    setDeletingId(reviewId);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setError('');
    try {
      await api.delete(`/contents/${contentId}/reviews/${deletingId}`);
      setReviews((prev) => prev.filter((r) => r.review_id !== deletingId));
      setTotalCount((c) => Math.max(0, c - 1));
      setDeletingId(null);
    } catch {
      setError('レビューの削除に失敗しました');
    }
  };

  /* ── Sort change ── */

  const handleSortChange = (option: SortOption) => {
    setSortBy(option);
    setCursor(null);
  };

  /* ── Render ── */

  return (
    <section className="mt-10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare size={20} className="text-gray-500" />
        <h2 className="text-lg font-bold">レビュー</h2>
      </div>

      {/* Average rating summary */}
      {totalCount > 0 && (
        <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-800">
              {averageRating.toFixed(1)}
            </p>
            <StarRating rating={Math.round(averageRating)} size={18} />
          </div>
          <p className="text-sm text-gray-500">{totalCount}件のレビュー</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deletingId && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">このレビューを削除しますか?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setDeletingId(null)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
            >
              削除する
            </button>
          </div>
        </div>
      )}

      {/* Write a review form -- only if logged in and no existing review */}
      {user && !myReview && !editingReview && (
        <div className="mb-6 p-4 border border-gray-200 rounded-xl">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            レビューを書く
          </h3>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">評価</label>
            <StarSelector value={newRating} onChange={setNewRating} />
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">
              コメント（任意・最大1000文字）
            </label>
            <textarea
              value={newComment}
              onChange={(e) =>
                setNewComment(e.target.value.slice(0, 1000))
              }
              rows={3}
              placeholder="感想を書いてください..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right">
              {newComment.length}/1000
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || newRating === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {submitting ? '送信中...' : '投稿する'}
          </button>
        </div>
      )}

      {/* Edit review inline form */}
      {editingReview && (
        <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-xl">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            レビューを編集
          </h3>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">評価</label>
            <StarSelector value={editRating} onChange={setEditRating} />
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">
              コメント（任意・最大1000文字）
            </label>
            <textarea
              value={editComment}
              onChange={(e) =>
                setEditComment(e.target.value.slice(0, 1000))
              }
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <p className="text-xs text-gray-400 text-right">
              {editComment.length}/1000
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              disabled={submitting || editRating === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {submitting ? '更新中...' : '更新する'}
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Sort controls */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">並び替え:</span>
          {(
            [
              ['newest', '新しい順'],
              ['highest', '高評価順'],
              ['lowest', '低評価順'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleSortChange(key)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                sortBy === key
                  ? 'bg-brand-100 text-brand-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
              <div className="h-3 w-full bg-gray-100 rounded mt-2" />
              <div className="h-3 w-2/3 bg-gray-100 rounded mt-1" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          まだレビューはありません
        </p>
      ) : (
        <div>
          {reviews.map((review) => (
            <ReviewItem
              key={review.review_id}
              review={review}
              isOwn={user?.uid === review.user_id}
              onEdit={startEdit}
              onDelete={confirmDelete}
            />
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="text-center mt-4">
              <button
                onClick={() => fetchReviews(true)}
                disabled={loadingMore}
                className="px-4 py-2 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingMore ? '読み込み中...' : 'もっと見る'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
