'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { History, RotateCcw, ArrowLeft, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface ContentVersion {
  version_id: string;
  version_number: number;
  title: string;
  body_markdown: string;
  excerpt: string;
  created_at: string;
}

interface CurrentContent {
  content_id: string;
  title: string;
  body_markdown: string | null;
  excerpt: string;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  let oi = 0;
  let ni = 0;

  // Simple LCS-based approach for better diffs
  // Build a map of new lines for quick lookup
  const newLineMap = new Map<string, number[]>();
  newLines.forEach((line, idx) => {
    if (!newLineMap.has(line)) newLineMap.set(line, []);
    newLineMap.get(line)!.push(idx);
  });

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi >= oldLines.length) {
      result.push({ type: 'added', text: newLines[ni] });
      ni++;
    } else if (ni >= newLines.length) {
      result.push({ type: 'removed', text: oldLines[oi] });
      oi++;
    } else if (oldLines[oi] === newLines[ni]) {
      result.push({ type: 'unchanged', text: oldLines[oi] });
      oi++;
      ni++;
    } else {
      // Look ahead to find if the old line appears later in new (it was moved/kept)
      // or if the new line appears later in old
      let foundInNew = -1;
      let foundInOld = -1;
      const lookAhead = Math.min(10, maxLen);

      for (let k = 1; k <= lookAhead; k++) {
        if (foundInNew === -1 && ni + k < newLines.length && oldLines[oi] === newLines[ni + k]) {
          foundInNew = k;
        }
        if (foundInOld === -1 && oi + k < oldLines.length && newLines[ni] === oldLines[oi + k]) {
          foundInOld = k;
        }
      }

      if (foundInOld !== -1 && (foundInNew === -1 || foundInOld <= foundInNew)) {
        // Lines were removed before a match
        for (let k = 0; k < foundInOld; k++) {
          result.push({ type: 'removed', text: oldLines[oi + k] });
        }
        oi += foundInOld;
      } else if (foundInNew !== -1) {
        // Lines were added before a match
        for (let k = 0; k < foundInNew; k++) {
          result.push({ type: 'added', text: newLines[ni + k] });
        }
        ni += foundInNew;
      } else {
        result.push({ type: 'removed', text: oldLines[oi] });
        result.push({ type: 'added', text: newLines[ni] });
        oi++;
        ni++;
      }
    }
  }

  return result;
}

function VersionSkeleton() {
  return (
    <div className="flex h-screen bg-gray-50 animate-pulse">
      <div className="w-80 bg-white border-r p-4 space-y-4">
        <div className="h-6 bg-gray-200 rounded w-3/4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2 p-3 rounded-lg bg-gray-50">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        ))}
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="space-y-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VersionHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const contentId = params.id as string;

  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [currentContent, setCurrentContent] = useState<CurrentContent | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ContentVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<ContentVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [versionsRes, contentRes] = await Promise.all([
        api.get<ContentVersion[]>(`/contents/${contentId}/versions`),
        api.get<CurrentContent>(`/contents/${contentId}`),
      ]);
      setVersions(versionsRes.data);
      setCurrentContent(contentRes.data);
      if (versionsRes.data.length > 0) {
        setSelectedVersion(versionsRes.data[0]);
      }
    } catch {
      setError('バージョン履歴の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== 'creator' && user.role !== 'admin') {
        router.push('/');
        return;
      }
      fetchData();
    }
  }, [authLoading, user, fetchData, router]);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await api.post(`/contents/${contentId}/versions/${restoreTarget.version_id}/restore`);
      await fetchData();
      setRestoreTarget(null);
    } catch {
      setError('バージョンの復元に失敗しました');
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return <VersionSkeleton />;
  }

  if (!user || (user.role !== 'creator' && user.role !== 'admin')) {
    return null;
  }

  if (error && versions.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            戻る
          </button>
        </div>
      </div>
    );
  }

  const diffLines = selectedVersion && currentContent
    ? computeDiff(selectedVersion.body_markdown || '', currentContent.body_markdown || '')
    : [];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left sidebar - version timeline */}
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
              title="戻る"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-gray-700" />
              <h1 className="text-lg font-semibold text-gray-900">バージョン履歴</h1>
            </div>
          </div>
          {currentContent && (
            <p className="mt-2 text-sm text-gray-500 truncate pl-9">{currentContent.title}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Current version indicator */}
          <div className="px-3 py-2 mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              バージョン一覧
            </span>
          </div>

          {versions.map((version) => {
            const isSelected = selectedVersion?.version_id === version.version_id;
            return (
              <button
                key={version.version_id}
                onClick={() => setSelectedVersion(version)}
                className={`w-full text-left p-3 rounded-lg transition-colors relative ${
                  isSelected
                    ? 'bg-blue-50 border border-blue-200 shadow-sm'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                {/* Timeline connector */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 -ml-1.5">
                  <div
                    className={`w-full h-full ${
                      isSelected ? 'bg-blue-400' : 'bg-gray-200'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-medium ${
                      isSelected ? 'text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    v{version.version_number}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRestoreTarget(version);
                    }}
                    className="p-1 rounded hover:bg-gray-200 transition-colors"
                    title="このバージョンに復元"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-gray-400 hover:text-gray-700" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-1">{formatDate(version.created_at)}</p>
                <p
                  className={`text-xs truncate ${
                    isSelected ? 'text-blue-600' : 'text-gray-600'
                  }`}
                >
                  {version.title}
                </p>
              </button>
            );
          })}

          {versions.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">バージョン履歴がありません</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main area - diff view */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {selectedVersion ? (
                <>
                  <h2 className="text-lg font-semibold text-gray-900">
                    v{selectedVersion.version_number} との差分
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatDate(selectedVersion.created_at)} 時点の内容と現在の内容を比較
                  </p>
                </>
              ) : (
                <h2 className="text-lg font-semibold text-gray-500">
                  バージョンを選択してください
                </h2>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* Diff legend */}
          {selectedVersion && diffLines.length > 0 && (
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200" />
                <span>選択バージョンのみ (削除)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200" />
                <span>現在のバージョンのみ (追加)</span>
              </div>
            </div>
          )}
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-y-auto">
          {selectedVersion && diffLines.length > 0 ? (
            <div className="font-mono text-sm">
              {diffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    line.type === 'added'
                      ? 'bg-green-100'
                      : line.type === 'removed'
                      ? 'bg-red-100'
                      : 'bg-white'
                  }`}
                >
                  <span
                    className={`w-12 flex-shrink-0 text-right pr-3 py-0.5 select-none text-xs leading-6 ${
                      line.type === 'added'
                        ? 'text-green-500 bg-green-200/50'
                        : line.type === 'removed'
                        ? 'text-red-500 bg-red-200/50'
                        : 'text-gray-400 bg-gray-50'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={`w-6 flex-shrink-0 text-center py-0.5 select-none leading-6 ${
                      line.type === 'added'
                        ? 'text-green-600'
                        : line.type === 'removed'
                        ? 'text-red-600'
                        : 'text-gray-300'
                    }`}
                  >
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="py-0.5 px-2 leading-6 whitespace-pre-wrap break-all flex-1">
                    {line.text || '\u00A0'}
                  </span>
                </div>
              ))}
            </div>
          ) : selectedVersion ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Check className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">差分はありません</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">左のサイドバーからバージョンを選択してください</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Restore confirmation modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !restoring && setRestoreTarget(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">バージョンを復元</h3>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              以下のバージョンに復元しますか？現在の内容は新しいバージョンとして保存されます。
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-6">
              <p className="text-sm font-medium text-gray-900">
                v{restoreTarget.version_number} - {restoreTarget.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formatDate(restoreTarget.created_at)}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setRestoreTarget(null)}
                disabled={restoring}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {restoring ? '復元中...' : '復元する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
