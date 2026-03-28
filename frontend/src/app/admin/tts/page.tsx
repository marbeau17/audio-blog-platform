'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Activity, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface TTSJob {
  id: string;
  content_id: string;
  content_title: string;
  creator_name: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: number;
  progress: number;
  error_message?: string;
  created_at: string;
}

interface TTSQueueResponse {
  jobs: TTSJob[];
  summary: {
    total_queued: number;
    processing: number;
    completed_today: number;
    failed_today: number;
  };
}

type StatusFilter = 'all' | 'queued' | 'processing' | 'failed' | 'completed';

const STATUS_CONFIG: Record<TTSJob['status'], { label: string; color: string; icon: typeof Activity }> = {
  queued: { label: '待機中', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  processing: { label: '処理中', color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
  completed: { label: '完了', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { label: '失敗', color: 'bg-red-100 text-red-800', icon: AlertCircle },
};

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'queued', label: '待機中' },
  { key: 'processing', label: '処理中' },
  { key: 'failed', label: '失敗' },
  { key: 'completed', label: '完了' },
];

export default function AdminTTSQueuePage() {
  const [data, setData] = useState<TTSQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await api.get<TTSQueueResponse>('/admin/tts/queue');
      setData(res.data);
    } catch (err: unknown) {
      console.error('TTS queue fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleRetry = async (jobId: string) => {
    setRetryingId(jobId);
    try {
      await api.post(`/admin/tts/queue/${jobId}/retry`);
      await fetchQueue();
    } catch (err: unknown) {
      console.error('Retry failed:', err);
    } finally {
      setRetryingId(null);
    }
  };

  const filteredJobs = data?.jobs.filter(
    (job) => filter === 'all' || job.status === filter
  ) ?? [];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-10 w-full bg-gray-100 rounded animate-pulse mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-50 rounded animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <a
              href="/admin"
              className="text-sm text-gray-500 hover:text-brand-600 transition mb-2 inline-block"
            >
              &larr; 管理者ダッシュボードに戻る
            </a>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-brand-600" />
              TTS ジョブキュー管理
            </h1>
          </div>
          <button
            onClick={() => { setLoading(true); fetchQueue(); }}
            className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg border hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
        </div>

        {/* Summary Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              label="待機中"
              value={data.summary.total_queued}
              icon={<Clock className="w-5 h-5 text-yellow-500" />}
              accent="border-yellow-300"
            />
            <SummaryCard
              label="処理中"
              value={data.summary.processing}
              icon={<RefreshCw className="w-5 h-5 text-blue-500" />}
              accent="border-blue-300"
            />
            <SummaryCard
              label="本日完了"
              value={data.summary.completed_today}
              icon={<CheckCircle className="w-5 h-5 text-green-500" />}
              accent="border-green-300"
            />
            <SummaryCard
              label="本日失敗"
              value={data.summary.failed_today}
              icon={<AlertCircle className="w-5 h-5 text-red-500" />}
              accent="border-red-300"
            />
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex gap-1 mb-6 border-b">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                filter === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Job Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 font-medium">コンテンツ</th>
                <th className="pb-3 font-medium">クリエイター</th>
                <th className="pb-3 font-medium">ステータス</th>
                <th className="pb-3 font-medium">優先度</th>
                <th className="pb-3 font-medium">進捗</th>
                <th className="pb-3 font-medium">作成日</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    該当するジョブはありません
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    retrying={retryingId === job.id}
                    onRetry={handleRetry}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className={`card p-4 border-l-4 ${accent}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{label}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}

function JobRow({
  job,
  retrying,
  onRetry,
}: {
  job: TTSJob;
  retrying: boolean;
  onRetry: (id: string) => void;
}) {
  const config = STATUS_CONFIG[job.status];
  const StatusIcon = config.icon;

  return (
    <>
      <tr className="border-b hover:bg-gray-50 transition">
        <td className="py-3 pr-4">
          <span className="font-medium text-gray-800">{job.content_title}</span>
        </td>
        <td className="py-3 pr-4 text-gray-600">{job.creator_name}</td>
        <td className="py-3 pr-4">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
          >
            <StatusIcon className="w-3 h-3" />
            {config.label}
          </span>
        </td>
        <td className="py-3 pr-4 text-gray-600">{job.priority}</td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  job.status === 'failed' ? 'bg-red-500' : 'bg-brand-600'
                }`}
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{job.progress}%</span>
          </div>
        </td>
        <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
          {new Date(job.created_at).toLocaleString('ja-JP')}
        </td>
        <td className="py-3">
          {job.status === 'failed' && (
            <button
              onClick={() => onRetry(job.id)}
              disabled={retrying}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
              リトライ
            </button>
          )}
        </td>
      </tr>
      {job.status === 'failed' && job.error_message && (
        <tr className="bg-red-50/50">
          <td colSpan={7} className="px-4 py-2">
            <div className="flex items-start gap-2 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{job.error_message}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
