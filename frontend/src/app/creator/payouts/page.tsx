'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

/* ─── Types ──────────────────────────────────────── */

interface PayoutSummary {
  total_earnings: number;
  pending_earnings: number;
  available_for_payout: number;
  paid_out: number;
  minimum_payout: number;
}

interface Payout {
  payout_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripe_transfer_id: string | null;
  requested_at: string;
  completed_at: string | null;
}

interface PayoutSchedule {
  type: 'immediate' | 'weekly' | 'monthly';
}

type ScheduleType = PayoutSchedule['type'];

/* ─── Helpers ────────────────────────────────────── */

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const STATUS_LABELS: Record<Payout['status'], { label: string; className: string }> = {
  pending: { label: '申請中', className: 'bg-yellow-100 text-yellow-800' },
  processing: { label: '処理中', className: 'bg-blue-100 text-blue-800' },
  completed: { label: '完了', className: 'bg-green-100 text-green-800' },
  failed: { label: '失敗', className: 'bg-red-100 text-red-800' },
};

const SCHEDULE_OPTIONS: { value: ScheduleType; label: string; description: string }[] = [
  { value: 'immediate', label: '即時', description: '利用可能になり次第自動振込' },
  { value: 'weekly', label: '毎週', description: '毎週月曜日にまとめて振込' },
  { value: 'monthly', label: '毎月', description: '毎月1日にまとめて振込' },
];

/* ─── Skeleton ───────────────────────────────────── */

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header skeleton */}
      <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5">
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse mb-3" />
            <div className="h-7 w-28 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Stripe status skeleton */}
      <div className="card p-6">
        <div className="h-5 w-40 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="card p-6">
        <div className="h-5 w-32 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Page Component ─────────────────────────────── */

export default function CreatorPayoutsPage() {
  const { user, loading: authLoading } = useAuth();

  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [schedule, setSchedule] = useState<ScheduleType>('monthly');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const stripeConnected = user?.creatorProfile?.stripeOnboardingComplete ?? false;
  const chargesEnabled = user?.creatorProfile?.chargesEnabled ?? false;

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, payoutsRes, scheduleRes] = await Promise.all([
        api.get<PayoutSummary>('/creator/payouts/summary'),
        api.get<Payout[]>('/creator/payouts'),
        api.get<PayoutSchedule>('/creator/payouts/schedule'),
      ]);
      setSummary(summaryRes.data);
      setPayouts(payoutsRes.data);
      setSchedule(scheduleRes.data.type);
    } catch {
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user, fetchData]);

  const handleRequestPayout = async () => {
    if (!summary || summary.available_for_payout < summary.minimum_payout) return;

    setRequesting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await api.post('/creator/payouts/request');
      setSuccessMessage('振込申請を受け付けました');
      await fetchData();
    } catch {
      setError('振込申請に失敗しました。しばらく経ってから再度お試しください。');
    } finally {
      setRequesting(false);
    }
  };

  const handleScheduleChange = async (newSchedule: ScheduleType) => {
    setSavingSchedule(true);
    setError(null);

    try {
      await api.put('/creator/payouts/schedule', { type: newSchedule });
      setSchedule(newSchedule);
      setSuccessMessage('振込スケジュールを更新しました');
    } catch {
      setError('スケジュールの更新に失敗しました');
    } finally {
      setSavingSchedule(false);
    }
  };

  // Clear messages after 4 seconds
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  if (loading || authLoading) return <Skeleton />;

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-500">
        ログインが必要です
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">売上・振込管理</h1>
          <p className="text-sm text-gray-500 mt-1">収益の確認と振込申請を行えます</p>
        </div>
        <Link href="/creator" className="btn-secondary text-sm">
          ダッシュボードへ戻る
        </Link>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {successMessage}
        </div>
      )}

      {/* Stripe Connect Status */}
      {!stripeConnected && (
        <div className="mb-6 p-5 card border-2 border-yellow-300 bg-yellow-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠</span>
            <div>
              <h3 className="font-semibold text-yellow-800">Stripeアカウントの連携が必要です</h3>
              <p className="text-sm text-yellow-700 mt-1">
                振込を受け取るには、Stripe Connectアカウントの設定を完了してください。
              </p>
              <Link
                href="/creator/stripe"
                className="inline-block mt-3 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Stripeアカウントを設定する
              </Link>
            </div>
          </div>
        </div>
      )}

      {stripeConnected && !chargesEnabled && (
        <div className="mb-6 p-5 card border-2 border-orange-300 bg-orange-50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <h3 className="font-semibold text-orange-800">Stripeアカウントの審査中です</h3>
              <p className="text-sm text-orange-700 mt-1">
                アカウントの審査が完了するまで、振込機能はご利用いただけません。通常1〜2営業日で完了します。
              </p>
            </div>
          </div>
        </div>
      )}

      {stripeConnected && chargesEnabled && (
        <div className="mb-6 p-4 card border border-green-200 bg-green-50 flex items-center gap-3">
          <span className="text-lg text-green-600">&#10003;</span>
          <div>
            <span className="text-sm font-medium text-green-800">Stripe Connect 連携済み</span>
            <span className="text-xs text-green-600 ml-2">
              アカウントID: {user.creatorProfile?.stripeAccountId}
            </span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5 text-center">
            <p className="text-xs text-gray-500 mb-1">総売上</p>
            <p className="text-xl font-bold text-green-600">{formatYen(summary.total_earnings)}</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-xs text-gray-500 mb-1">保留中</p>
            <p className="text-xl font-bold text-yellow-600">{formatYen(summary.pending_earnings)}</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-xs text-gray-500 mb-1">振込可能額</p>
            <p className="text-xl font-bold text-brand-600">{formatYen(summary.available_for_payout)}</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-xs text-gray-500 mb-1">振込済み</p>
            <p className="text-xl font-bold text-gray-700">{formatYen(summary.paid_out)}</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 mb-8">
        {/* Request Payout */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4">振込申請</h2>
          {summary && (
            <>
              <p className="text-sm text-gray-600 mb-2">
                振込可能額: <span className="font-bold text-brand-600">{formatYen(summary.available_for_payout)}</span>
              </p>
              <p className="text-xs text-gray-400 mb-4">
                最低振込額: {formatYen(summary.minimum_payout)}
              </p>
              <button
                onClick={handleRequestPayout}
                disabled={
                  requesting ||
                  !stripeConnected ||
                  !chargesEnabled ||
                  !summary ||
                  summary.available_for_payout < summary.minimum_payout
                }
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requesting ? '処理中...' : '振込を申請する'}
              </button>
              {summary.available_for_payout < summary.minimum_payout && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  振込可能額が最低振込額（{formatYen(summary.minimum_payout)}）に達していません
                </p>
              )}
            </>
          )}
        </div>

        {/* Payout Schedule */}
        <div className="md:col-span-2 card p-6">
          <h2 className="font-semibold mb-4">振込スケジュール</h2>
          <div className="grid gap-3">
            {SCHEDULE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  schedule === option.value
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${savingSchedule ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="radio"
                  name="schedule"
                  value={option.value}
                  checked={schedule === option.value}
                  onChange={() => handleScheduleChange(option.value)}
                  disabled={savingSchedule}
                  className="accent-brand-600"
                />
                <div>
                  <span className="text-sm font-medium">{option.label}</span>
                  <p className="text-xs text-gray-500">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Payout History */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4">振込履歴</h2>

        {payouts.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">まだ振込履歴がありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">日付</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">金額</th>
                  <th className="text-center py-3 px-2 font-medium text-gray-500">ステータス</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Stripe Transfer ID</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => {
                  const status = STATUS_LABELS[payout.status];
                  return (
                    <tr key={payout.payout_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 text-gray-700">
                        {formatDate(payout.requested_at)}
                      </td>
                      <td className="py-3 px-2 text-right font-medium">
                        {formatYen(payout.amount)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-gray-500 font-mono text-xs">
                        {payout.stripe_transfer_id ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
