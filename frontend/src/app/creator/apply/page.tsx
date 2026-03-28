'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mic,
  Upload,
  BarChart3,
  Banknote,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function CreatorApplyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== 'listener') {
      router.push('/creator');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      setContactEmail(user.email || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeToTerms || !fullName.trim() || !contactEmail.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      await api.post('/auth/upgrade-to-creator', {
        full_name: fullName.trim(),
        contact_email: contactEmail.trim(),
        agree_to_terms: agreeToTerms,
      });
      setSuccess(true);
    } catch {
      setError('クリエイター登録に失敗しました。しばらくしてからお試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!user || user.role !== 'listener') return null;

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-3">クリエイター登録が完了しました</h1>
        <p className="text-gray-600 mb-8">
          コンテンツの作成や音声配信を始めることができます。
        </p>
        <Link
          href="/creator"
          className="btn-primary inline-flex items-center gap-2"
        >
          クリエイターダッシュボードへ
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">クリエイターになる</h1>
      <p className="text-gray-600 mb-8">
        クリエイターとして登録すると、音声コンテンツの作成・配信ができるようになります。
      </p>

      {/* What creators can do */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-brand-800 mb-4">
          クリエイターにできること
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-900">音声コンテンツの作成</p>
              <p className="text-xs text-brand-700 mt-0.5">
                記事をAI音声で自動変換して配信
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-900">コンテンツの公開</p>
              <p className="text-xs text-brand-700 mt-0.5">
                無料・有料コンテンツを自由に公開
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-900">アナリティクス</p>
              <p className="text-xs text-brand-700 mt-0.5">
                再生数や収益データをリアルタイムで確認
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-900">収益化</p>
              <p className="text-xs text-brand-700 mt-0.5">
                有料コンテンツの販売やチップで収益を得る
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Application form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">クリエイター登録フォーム</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              氏名
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              placeholder="山田 太郎"
            />
          </div>

          <div>
            <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
              連絡先メール
            </label>
            <input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              placeholder="example@email.com"
            />
          </div>

          <div className="flex items-start gap-3 pt-2">
            <input
              id="agreeToTerms"
              type="checkbox"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="agreeToTerms" className="text-sm text-gray-700">
              <span className="font-medium">利用規約に同意する</span>
              <br />
              <span className="text-gray-500">
                クリエイターとしての利用規約・ガイドラインに同意の上、登録してください。
              </span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !agreeToTerms || !fullName.trim() || !contactEmail.trim()}
            className="btn-primary inline-flex items-center gap-2 w-full justify-center"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            {submitting ? '登録中...' : 'クリエイターとして登録する'}
          </button>
        </form>
      </div>
    </div>
  );
}
