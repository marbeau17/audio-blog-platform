'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

interface PlatformAnalytics {
  users: { total: number; creators: number; listeners: number };
  content: { total: number; published: number };
  revenue: { total: number; currency: string };
  engagement: { total_plays: number };
}

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [ttsQueue, setTtsQueue] = useState<{ queue: Record<string, number>; total_active: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<PlatformAnalytics>('/admin/analytics/platform'),
      api.get<{ queue: Record<string, number>; total_active: number }>('/admin/tts/queue'),
    ])
      .then(([a, q]) => { setAnalytics(a.data); setTtsQueue(q.data); })
      .catch((err: unknown) => { console.error('Operation failed:', err); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8"><div className="h-48 bg-gray-100 rounded-xl animate-pulse" /></div>;

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-8">管理者ダッシュボード</h1>

        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="総ユーザー" value={analytics.users.total} />
            <StatCard label="クリエイター" value={analytics.users.creators} />
            <StatCard label="公開コンテンツ" value={analytics.content.published} />
            <StatCard label="総売上" value={`¥${analytics.revenue.total.toLocaleString()}`} />
            <StatCard label="総再生数" value={analytics.engagement.total_plays.toLocaleString()} />
            <StatCard label="総コンテンツ" value={analytics.content.total} />
            {ttsQueue && (
              <>
                <StatCard label="TTS処理中" value={ttsQueue.total_active} />
                <StatCard label="TTS待機中" value={ttsQueue.queue.queued || 0} />
              </>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="font-semibold mb-4">クイックリンク</h2>
            <div className="space-y-2">
              <AdminLink href="/admin/users" label="ユーザー管理" />
              <AdminLink href="/admin/moderation" label="コンテンツモデレーション" />
              <AdminLink href="/admin/tts" label="TTS ジョブ管理" />
              <AdminLink href="/admin/system" label="システム設定" />
            </div>
          </div>
          <div className="card p-6">
            <h2 className="font-semibold mb-4">システムヘルス</h2>
            <HealthCheck />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xl font-bold text-brand-600">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="block px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-gray-700 hover:text-brand-600 transition">
      → {label}
    </a>
  );
}

function HealthCheck() {
  const [health, setHealth] = useState<Record<string, { status: string }> | null>(null);
  useEffect(() => {
    api.get<{ services: Record<string, { status: string }> }>('/health/detailed')
      .then((res) => setHealth(res.data.services))
      .catch(() => setHealth(null));
  }, []);

  if (!health) return <p className="text-gray-400 text-sm">ヘルスチェック取得中...</p>;
  return (
    <div className="space-y-2">
      {Object.entries(health).map(([svc, info]) => (
        <div key={svc} className="flex items-center justify-between text-sm">
          <span className="text-gray-600 capitalize">{svc}</span>
          <span className={info.status === 'healthy' ? 'text-green-600' : 'text-red-600'}>
            {info.status === 'healthy' ? '✓ 正常' : '✗ 異常'}
          </span>
        </div>
      ))}
    </div>
  );
}
