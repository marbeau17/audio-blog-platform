'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { CreditCard, CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface StripeStatus {
  connected: boolean;
  stripe_account_id?: string;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
}

interface OnboardResponse {
  url: string;
}

type AccountState = 'not_connected' | 'pending' | 'active';

function getAccountState(status: StripeStatus): AccountState {
  if (!status.connected) return 'not_connected';
  if (status.charges_enabled && status.payouts_enabled && status.details_submitted) return 'active';
  return 'pending';
}

export default function CreatorStripePage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await api.get<StripeStatus>('/creator/stripe/status');
      setStatus(res.data);
      setError(null);
    } catch (err: unknown) {
      console.error('Operation failed:', err);
      setError('Stripe接続状況の取得に失敗しました');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    setOnboarding(true);
    setError(null);
    try {
      const res = await api.post<OnboardResponse>('/creator/stripe/onboard');
      window.location.href = res.data.url;
    } catch (err: unknown) {
      console.error('Operation failed:', err);
      setError('Stripeオンボーディングの開始に失敗しました');
      setOnboarding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  const accountState = status ? getAccountState(status) : 'not_connected';

  const statusConfig = {
    not_connected: {
      icon: <CreditCard className="w-8 h-8 text-gray-400" />,
      title: 'Stripeアカウント未接続',
      description: 'Stripeアカウントを接続して、コンテンツの販売を始めましょう。',
      badgeClass: 'bg-gray-100 text-gray-700',
      badgeText: '未接続',
    },
    pending: {
      icon: <AlertCircle className="w-8 h-8 text-yellow-500" />,
      title: '確認待ち',
      description: 'Stripeによるアカウント確認が進行中です。確認完了後、決済が有効になります。',
      badgeClass: 'bg-yellow-100 text-yellow-700',
      badgeText: '確認中',
    },
    active: {
      icon: <CheckCircle className="w-8 h-8 text-green-500" />,
      title: 'Stripeアカウント有効',
      description: 'Stripeアカウントは有効で、決済を受け付ける準備ができています。',
      badgeClass: 'bg-green-100 text-green-700',
      badgeText: '有効',
    },
  };

  const config = statusConfig[accountState];

  const indicators = [
    { label: '決済受付', enabled: status?.charges_enabled ?? false },
    { label: '詳細情報送信済み', enabled: status?.details_submitted ?? false },
    { label: '出金有効', enabled: status?.payouts_enabled ?? false },
  ];

  return (
    <ProtectedRoute requiredRole="creator">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Stripe設定</h1>
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            ステータス更新
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Status Card */}
        <div className="card p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 mt-1">{config.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold">{config.title}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badgeClass}`}>
                  {config.badgeText}
                </span>
              </div>
              <p className="text-sm text-gray-600">{config.description}</p>
            </div>
          </div>

          {/* Status Indicators */}
          {status?.connected && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-4">
                {indicators.map((ind) => (
                  <div key={ind.label} className="flex items-center gap-2">
                    {ind.enabled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                    <span className="text-sm text-gray-700">{ind.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connect Button */}
          {accountState !== 'active' && (
            <div className="mt-6">
              <button
                onClick={handleConnect}
                disabled={onboarding}
                className="btn-primary flex items-center gap-2"
              >
                {onboarding ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    リダイレクト中...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    {accountState === 'not_connected' ? 'Stripeアカウントを接続' : 'Stripe設定を続ける'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="card p-6 mb-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-600" />
            決済について
          </h2>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-800 mb-1">プラットフォーム手数料</h3>
              <p>
                各販売の20%がプラットフォーム手数料として差し引かれます。残りの80%がクリエイターの収益となります。
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-1">出金について</h3>
              <p>
                売上はStripeアカウントに自動的に蓄積されます。Stripeの出金スケジュールに従い、登録した銀行口座に振り込まれます。
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-1">最低出金額</h3>
              <p>
                最低出金額は¥1,000です。残高が最低出金額に達するまで、出金は保留されます。
              </p>
            </div>
          </div>
        </div>

        {/* Back to Dashboard */}
        <Link
          href="/creator"
          className="text-sm text-gray-500 hover:text-brand-600 transition-colors"
        >
          &larr; ダッシュボードに戻る
        </Link>
      </div>
    </ProtectedRoute>
  );
}
