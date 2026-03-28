'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Shield, Ban, CheckCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

type Role = 'listener' | 'creator' | 'admin';

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: Role;
  status: 'active' | 'suspended';
  created_at: string;
}

interface UsersResponse {
  users: User[];
  total: number;
}

const ROLE_TABS: { label: string; value: Role | 'all' }[] = [
  { label: 'すべて', value: 'all' },
  { label: 'リスナー', value: 'listener' },
  { label: 'クリエイター', value: 'creator' },
  { label: '管理者', value: 'admin' },
];

const ROLE_BADGE_STYLES: Record<Role, string> = {
  listener: 'bg-blue-100 text-blue-700',
  creator: 'bg-purple-100 text-purple-700',
  admin: 'bg-red-100 text-red-700',
};

const ROLE_LABELS: Record<Role, string> = {
  listener: 'リスナー',
  creator: 'クリエイター',
  admin: '管理者',
};

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = roleFilter !== 'all' ? `?role=${roleFilter}` : '';
      const res = await api.get<UsersResponse>(`/admin/users${params}`);
      setUsers(res.data.users);
    } catch (err: unknown) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, searchQuery]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.display_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleChangeRole = async (userId: string, newRole: Role) => {
    setActionLoading(userId);
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err: unknown) {
      console.error('Failed to change role:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (userId: string) => {
    if (!suspendReason.trim()) return;
    setActionLoading(userId);
    try {
      await api.post(`/admin/users/${userId}/suspend`, { reason: suspendReason });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: 'suspended' as const } : u))
      );
      setSuspendTarget(null);
      setSuspendReason('');
    } catch (err: unknown) {
      console.error('Failed to suspend user:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.post(`/admin/users/${userId}/unsuspend`, {});
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: 'active' as const } : u))
      );
    } catch (err: unknown) {
      console.error('Failed to unsuspend user:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Users className="h-7 w-7 text-brand-600" />
          <h1 className="text-2xl font-bold">ユーザー管理</h1>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="名前またはメールで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Role filter tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRoleFilter(tab.value)}
              className={`px-4 py-1.5 text-sm rounded-md transition font-medium ${
                roleFilter === tab.value
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* User table */}
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-3 font-medium">ユーザー</th>
                    <th className="pb-3 font-medium">メール</th>
                    <th className="pb-3 font-medium">ロール</th>
                    <th className="pb-3 font-medium">ステータス</th>
                    <th className="pb-3 font-medium">登録日</th>
                    <th className="pb-3 font-medium text-right">アクション</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        ユーザーが見つかりません
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.display_name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                                {user.display_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-medium text-gray-900">
                              {user.display_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{user.email}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_STYLES[user.role]}`}
                          >
                            {ROLE_LABELS[user.role]}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {user.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle className="h-3.5 w-3.5" />
                              アクティブ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                              <Ban className="h-3.5 w-3.5" />
                              停止中
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-500">
                          {new Date(user.created_at).toLocaleDateString('ja-JP')}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={user.role}
                              onChange={(e) =>
                                handleChangeRole(user.id, e.target.value as Role)
                              }
                              disabled={actionLoading === user.id}
                              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                            >
                              <option value="listener">リスナー</option>
                              <option value="creator">クリエイター</option>
                              <option value="admin">管理者</option>
                            </select>

                            {user.status === 'active' ? (
                              <button
                                onClick={() => setSuspendTarget(user.id)}
                                disabled={actionLoading === user.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-50"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                停止
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUnsuspend(user.id)}
                                disabled={actionLoading === user.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded-md transition disabled:opacity-50"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                復帰
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {filteredUsers.length} 件中 {(currentPage - 1) * PAGE_SIZE + 1} -{' '}
                  {Math.min(currentPage * PAGE_SIZE, filteredUsers.length)} 件を表示
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Suspend modal */}
        {suspendTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold">ユーザーを停止</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                停止理由を入力してください。
              </p>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="停止理由..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setSuspendTarget(null);
                    setSuspendReason('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => handleSuspend(suspendTarget)}
                  disabled={!suspendReason.trim() || actionLoading === suspendTarget}
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
                >
                  停止する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <div className="h-8 w-8 rounded-full bg-gray-100 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
