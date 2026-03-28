'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Shield, Check, X, Eye, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

interface FlaggedContent {
  id: string;
  title: string;
  creator_name: string;
  flag_reason: string;
  flagged_at: string;
  status: string;
}

export default function ModerationPage() {
  const { user } = useAuth();
  const [contents, setContents] = useState<FlaggedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchFlagged = useCallback(async () => {
    try {
      const res = await api.get<FlaggedContent[]>('/admin/contents/flagged');
      setContents(res.data);
      setError(null);
    } catch (err: unknown) {
      console.error('Operation failed:', err);
      setError('フラグ付きコンテンツの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.post(`/admin/contents/${id}/moderate`, { action: 'approve' });
      setContents((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      console.error('Operation failed:', err);
      setError('承認に失敗しました');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    setActionLoading(id);
    try {
      await api.post(`/admin/contents/${id}/moderate`, {
        action: 'reject',
        reason: rejectReason.trim(),
      });
      setContents((prev) => prev.filter((c) => c.id !== id));
      setRejectTarget(null);
      setRejectReason('');
    } catch (err: unknown) {
      console.error('Operation failed:', err);
      setError('却下に失敗しました');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'flagged':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">フラグ付き</span>;
      case 'under_review':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">審査中</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            管理者ダッシュボードに戻る
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-7 w-7 text-brand-600" />
          <h1 className="text-2xl font-bold">コンテンツモデレーション</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-3 underline hover:no-underline"
            >
              閉じる
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : contents.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">フラグ付きコンテンツはありません</p>
            <p className="text-gray-400 text-sm mt-1">現在、審査が必要なコンテンツはありません。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">タイトル</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">クリエイター</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">フラグ理由</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">フラグ日時</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">ステータス</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">アクション</th>
                </tr>
              </thead>
              <tbody>
                {contents.map((content) => (
                  <tr key={content.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-3 px-4 font-medium text-gray-900 max-w-[200px] truncate">
                      {content.title}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{content.creator_name}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-[200px] truncate">
                      {content.flag_reason}
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {formatDate(content.flagged_at)}
                    </td>
                    <td className="py-3 px-4">{statusLabel(content.status)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/content/${content.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          閲覧
                        </Link>
                        <button
                          onClick={() => handleApprove(content.id)}
                          disabled={actionLoading === content.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          承認
                        </button>
                        <button
                          onClick={() => setRejectTarget(content.id)}
                          disabled={actionLoading === content.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          却下
                        </button>
                      </div>

                      {rejectTarget === content.id && (
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="却下理由を入力..."
                            className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                          />
                          <button
                            onClick={() => handleReject(content.id)}
                            disabled={!rejectReason.trim() || actionLoading === content.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
                          >
                            送信
                          </button>
                          <button
                            onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                          >
                            取消
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
