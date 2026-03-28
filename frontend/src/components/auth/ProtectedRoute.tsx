'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type Role = 'listener' | 'creator' | 'admin';

const ROLE_HIERARCHY: Record<Role, number> = {
  listener: 0,
  creator: 1,
  admin: 2,
};

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: Role;
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredRole = 'listener',
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push(redirectTo);
    }
  }, [loading, user, router, redirectTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  if (userLevel < requiredLevel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <ShieldAlert className="h-12 w-12 text-red-500" />
        <p className="text-lg font-semibold text-gray-700">アクセス権限がありません</p>
        <Link href="/" className="text-brand-600 hover:underline text-sm">
          ホームに戻る
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
