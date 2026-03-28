'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { Download, Calendar, TrendingUp, DollarSign } from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface EarningsSummary {
  total: number;
  this_month: number;
  last_month: number;
  pending: number;
}

interface Transaction {
  transaction_id: string;
  date: string;
  content_title: string;
  buyer_display_name: string;
  amount: number;
  platform_fee: number;
  creator_earnings: number;
  status: 'completed' | 'pending' | 'refunded';
}

interface MonthlyEarning {
  month: string; // e.g. "2026-03"
  amount: number;
}

interface EarningsData {
  summary: EarningsSummary;
  transactions: Transaction[];
  monthly_earnings: MonthlyEarning[];
}

type SortKey = 'date' | 'content_title' | 'amount' | 'platform_fee' | 'creator_earnings' | 'status';
type SortDir = 'asc' | 'desc';
type Period = 'week' | 'month' | 'quarter' | 'year' | 'custom';

/* ─── Helpers ─────────────────────────────────── */

const formatYen = (n: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(n);

const periodLabel: Record<Period, string> = {
  week: '今週',
  month: '今月',
  quarter: '四半期',
  year: '今年',
  custom: 'カスタム',
};

const statusLabel: Record<string, { text: string; cls: string }> = {
  completed: { text: '完了', cls: 'bg-green-100 text-green-700' },
  pending: { text: '保留中', cls: 'bg-yellow-100 text-yellow-700' },
  refunded: { text: '返金済', cls: 'bg-red-100 text-red-700' },
};

function shortMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}月`;
}

/* ─── Component ───────────────────────────────── */

export default function CreatorEarningsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [exporting, setExporting] = useState(false);

  /* ── Fetch earnings ── */
  const fetchEarnings = useCallback(() => {
    setLoading(true);
    let query = `/creator/earnings?period=${period}`;
    if (period === 'custom' && customFrom && customTo) {
      query += `&from=${customFrom}&to=${customTo}`;
    }
    api.get<EarningsData>(query)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  /* ── Sorting ── */
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedTransactions = useMemo(() => {
    if (!data) return [];
    const list = [...data.transactions];
    list.sort((a, b) => {
      let cmp = 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv, 'ja');
      } else if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data, sortKey, sortDir]);

  /* ── CSV Export ── */
  const handleExport = async () => {
    setExporting(true);
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) return;
      const token = await fbUser.getIdToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
      let url = `${API_BASE}/creator/earnings/export?format=csv&period=${period}`;
      if (period === 'custom' && customFrom && customTo) {
        url += `&from=${customFrom}&to=${customTo}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `earnings_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // silently fail — could add toast notification
    } finally {
      setExporting(false);
    }
  };

  /* ── Monthly chart helpers ── */
  const maxMonthly = useMemo(() => {
    if (!data?.monthly_earnings.length) return 0;
    return Math.max(...data.monthly_earnings.map((m) => m.amount));
  }, [data]);

  /* ── Render ── */

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-500">
        売上データの読み込みに失敗しました
      </div>
    );
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">売上詳細</h1>
          <p className="text-sm text-gray-500 mt-1">収益の詳細とエクスポート</p>
        </div>
        <Link href="/creator" className="text-sm text-brand-600 hover:underline">
          ← ダッシュボードに戻る
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-500">総売上</span>
          </div>
          <p className="text-xl font-bold text-green-600">{formatYen(data.summary.total)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-gray-500">今月</span>
          </div>
          <p className="text-xl font-bold text-blue-600">{formatYen(data.summary.this_month)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-500">先月</span>
          </div>
          <p className="text-xl font-bold text-purple-600">{formatYen(data.summary.last_month)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-yellow-600" />
            <span className="text-xs text-gray-500">保留中</span>
          </div>
          <p className="text-xl font-bold text-yellow-600">{formatYen(data.summary.pending)}</p>
        </div>
      </div>

      {/* Monthly Earnings Bar Chart */}
      <div className="card p-6 mb-8">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          月別売上（直近12ヶ月）
        </h2>
        {data.monthly_earnings.length === 0 ? (
          <p className="text-gray-400 text-sm">データがありません</p>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {data.monthly_earnings.map((m) => {
              const pct = maxMonthly > 0 ? (m.amount / maxMonthly) * 100 : 0;
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-[10px] text-gray-500 mb-1 whitespace-nowrap">
                    {formatYen(m.amount)}
                  </span>
                  <div
                    className="w-full bg-brand-500 rounded-t transition-all duration-300 min-h-[2px]"
                    style={{ height: `${Math.max(pct, 1)}%` }}
                  />
                  <span className="text-[10px] text-gray-500 mt-1">{shortMonth(m.month)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters & Export */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          {(Object.keys(periodLabel) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                period === p
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {periodLabel[p]}
            </button>
          ))}

          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
              <span className="text-gray-400">〜</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
          )}

          <div className="ml-auto">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'エクスポート中...' : 'CSVエクスポート'}
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-left">
                {([
                  ['date', '日付'],
                  ['content_title', 'コンテンツ'],
                  [null, '購入者'],
                  ['amount', '金額'],
                  ['platform_fee', 'プラットフォーム手数料'],
                  ['creator_earnings', '売上'],
                  ['status', 'ステータス'],
                ] as [SortKey | null, string][]).map(([key, label]) => (
                  <th
                    key={label}
                    className={`px-4 py-3 font-medium text-gray-600 whitespace-nowrap ${
                      key ? 'cursor-pointer select-none hover:text-gray-900' : ''
                    }`}
                    onClick={key ? () => toggleSort(key) : undefined}
                  >
                    {label}
                    {key && sortIndicator(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    取引データがありません
                  </td>
                </tr>
              ) : (
                sortedTransactions.map((tx) => {
                  const st = statusLabel[tx.status] ?? { text: tx.status, cls: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={tx.transaction_id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{tx.date}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate font-medium">{tx.content_title}</td>
                      <td className="px-4 py-3 text-gray-400">{tx.buyer_display_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatYen(tx.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatYen(tx.platform_fee)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-green-600">
                        {formatYen(tx.creator_earnings)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                          {st.text}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
