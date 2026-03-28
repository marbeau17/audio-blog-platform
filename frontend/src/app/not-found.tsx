import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center p-8">
        <h2 className="text-6xl font-bold text-gray-300 mb-4">404</h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">ページが見つかりません</h3>
        <p className="text-gray-600 mb-6">お探しのページは存在しないか、移動した可能性があります。</p>
        <Link href="/" className="btn-primary">ホームに戻る</Link>
      </div>
    </div>
  );
}
