'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, MessageSquare, ShoppingCart, Heart, Star, Volume2, AlertCircle, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

interface Notification {
  notification_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'たった今';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
}

function notificationIcon(type: string) {
  switch (type) {
    case 'purchase':
    case 'sale':
      return <ShoppingCart className="w-5 h-5 text-green-500" />;
    case 'comment':
    case 'reply':
      return <MessageSquare className="w-5 h-5 text-blue-500" />;
    case 'like':
    case 'favorite':
      return <Heart className="w-5 h-5 text-pink-500" />;
    case 'review':
      return <Star className="w-5 h-5 text-yellow-500" />;
    case 'tts_complete':
    case 'audio':
      return <Volume2 className="w-5 h-5 text-purple-500" />;
    default:
      return <AlertCircle className="w-5 h-5 text-gray-500" />;
  }
}

type FilterTab = 'all' | 'unread';

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(async (append = false, currentCursor?: string | null) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (filter === 'unread') params.set('unread', 'true');
      if (append && currentCursor) params.set('cursor', currentCursor);

      const res = await api.get<Notification[]>(`/notifications?${params.toString()}`);
      if (append) {
        setNotifications((prev) => [...prev, ...res.data]);
      } else {
        setNotifications(res.data);
      }
      setCursor(res.pagination?.cursor ?? null);
      setHasMore(res.pagination?.has_more ?? false);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }
    if (user) {
      fetchNotifications();
    }
  }, [user, authLoading, fetchNotifications, router]);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // silently ignore
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      // silently ignore
    }
  };

  const loadMore = () => {
    fetchNotifications(true, cursor);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-100 rounded" />
          <div className="h-16 bg-gray-100 rounded" />
          <div className="h-16 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">通知</h1>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            すべて既読にする
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            filter === 'all'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          すべて
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            filter === 'unread'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          未読
        </button>
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">
            {filter === 'unread' ? '未読の通知はありません' : '通知はまだありません'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.notification_id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                !n.is_read
                  ? 'bg-blue-50/50 border-blue-100 hover:bg-blue-50'
                  : 'bg-white border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                {notificationIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                  {n.title}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
              </div>
              <div className="flex-shrink-0">
                {!n.is_read ? (
                  <button
                    onClick={() => markAsRead(n.notification_id)}
                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                    title="既読にする"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <Check className="w-4 h-4 text-gray-300 mt-1.5" />
                )}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2 text-sm text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingMore ? '読み込み中...' : 'もっと見る'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
