'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { DashboardSummary } from '@/types';

export default function CreatorDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardSummary>('/creator/dashboard')
      .then((res) => setDashboard(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8"><div className="h-48 bg-gray-100 rounded-xl animate-pulse" /></div>;
  if (!dashboard) return <div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-500">ダッシュボードの読み込みに失敗しました</div>;

  const stats = [
    { label: '総売上', value: `¥${dashboard.total_earnings.toLocaleString()}`, color: 'text-green-600' },
    { label: '保留中', value: `¥${dashboard.pending_earnings.toLocaleString()}`, color: 'text-yellow-600' },
    { label: 'コンテンツ数', value: dashboard.total_content.toString(), color: 'text-brand-600' },
    { label: '総再生数', value: dashboard.total_plays.toLocaleString(), color: 'text-purple-600' },
    { label: '総購入数', value: dashboard.total_purchases.toLocaleString(), color: 'text-blue-600' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">クリエイターダッシュボード</h1>
        <Link href="/creator/new" className="btn-primary">新規作成</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Recent Earnings */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4">直近の売上</h2>
          {dashboard.recent_earnings.length === 0 ? (
            <p className="text-gray-400 text-sm">まだ売上がありません</p>
          ) : (
            <div className="space-y-2">
              {dashboard.recent_earnings.slice(0, 7).map((e) => (
                <div key={e.date} className="flex justify-between text-sm">
                  <span className="text-gray-600">{e.date}</span>
                  <span className="font-medium">¥{e.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Content */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4">人気コンテンツ</h2>
          {dashboard.top_content.length === 0 ? (
            <p className="text-gray-400 text-sm">まだコンテンツがありません</p>
          ) : (
            <div className="space-y-3">
              {dashboard.top_content.slice(0, 5).map((c, i) => (
                <div key={c.content_id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/content/${c.content_id}`} className="text-sm font-medium truncate hover:text-brand-600">
                      {c.title}
                    </Link>
                  </div>
                  <span className="text-xs text-gray-500">▶ {c.plays}</span>
                  <span className="text-xs font-medium text-green-600">¥{c.revenue.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/creator/contents" className="btn-secondary">コンテンツ管理</Link>
        <Link href="/creator/analytics" className="btn-secondary">アナリティクス</Link>
        <Link href="/creator/earnings" className="btn-secondary">売上詳細</Link>
        <Link href="/creator/stripe" className="btn-secondary">Stripe設定</Link>
      </div>
    </div>
  );
}
