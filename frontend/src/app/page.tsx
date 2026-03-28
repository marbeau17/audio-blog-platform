import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-900 to-brand-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            テキストを音声に。<br />知識を、耳で楽しむ。
          </h1>
          <p className="text-lg text-brand-100 mb-8 max-w-2xl mx-auto">
            ビジネス書・自己啓発本のエッセンスを音声で配信。通勤中や運動中に、いつでもどこでも学べるプラットフォーム。
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/content" className="px-6 py-3 bg-white text-brand-700 rounded-lg font-semibold hover:bg-gray-100 transition">
              コンテンツを探す
            </Link>
            <Link href="/auth/register" className="px-6 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition">
              無料で始める
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">3つの特長</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '🎧', title: 'AI音声で自動変換', desc: 'Google Cloud TTSで高品質な音声を自動生成。SSML対応で自然な読み上げ。' },
            { icon: '📝', title: 'ブログと音声を統合', desc: 'テキスト記事と音声コンテンツをワンストップで管理・配信。' },
            { icon: '💰', title: 'クリエイター収益化', desc: 'Stripe決済で安全にコンテンツを販売。売上の80%がクリエイターに還元。' },
          ].map((f) => (
            <div key={f.title} className="card p-6 text-center">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-100 py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">クリエイターとして始めませんか？</h2>
          <p className="text-gray-600 mb-6">
            あなたの知識やアイデアをテキストで書いて、ワンクリックで音声コンテンツに変換。世界中のリスナーに届けましょう。
          </p>
          <Link href="/auth/register?role=creator" className="btn-primary text-base px-8 py-3">
            クリエイター登録
          </Link>
        </div>
      </section>
    </div>
  );
}
