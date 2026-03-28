"""Seed script to populate sample content for the platform.

Usage:
    python -m scripts.seed_content

Requires:
    - Firebase Admin SDK credentials (FIREBASE_SERVICE_ACCOUNT_PATH or default credentials)
    - FIREBASE_PROJECT_ID environment variable
    - Admin user already created via seed_admin.py
"""

import os
import sys
import random
import uuid
from datetime import datetime, timezone, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import auth, credentials, firestore

# ──── Configuration ─────────────────────────────────
ADMIN_EMAIL = "marbeau17@gmail.com"

CREATORS = [
    {
        "email": "tanaka.yuki@example.com",
        "password": "Creator@2026!",
        "display_name": "田中 悠希",
        "bio": "テクノロジーとビジネスの交差点を探るライター。元エンジニア、現在はフリーランスで活動中。",
    },
    {
        "email": "suzuki.aoi@example.com",
        "password": "Creator@2026!",
        "display_name": "鈴木 葵",
        "bio": "自己啓発・ライフスタイル系コンテンツクリエイター。マインドフルネス指導者資格保持。",
    },
]

# 10 sample content items
SAMPLE_CONTENTS = [
    # ── 5 Japanese tech/business articles ──
    {
        "title": "生成AIが変えるソフトウェア開発の未来",
        "slug": "generative-ai-software-development-future",
        "excerpt": "生成AIの登場により、ソフトウェア開発のあり方が根本的に変わりつつあります。コード生成からテスト、デプロイまで、AIがどのように開発プロセスを変革するのかを解説します。",
        "body_markdown": """# 生成AIが変えるソフトウェア開発の未来

## はじめに

2025年以降、生成AIはソフトウェア開発の現場に深く浸透してきました。GitHub Copilotに始まったAIコーディング支援は、今やコード生成、バグ修正、テスト作成、さらにはアーキテクチャ設計にまで及んでいます。

## コード生成の進化

最新の大規模言語モデルは、自然言語による指示からプロダクション品質のコードを生成できるようになりました。これにより、開発者はより高い抽象度で作業ができるようになっています。

### 具体的な変化

- **プロトタイピングの高速化**: アイデアから動くプロトタイプまでの時間が劇的に短縮
- **ボイラープレートの削減**: 定型コードはAIに任せ、ビジネスロジックに集中
- **学習コストの低下**: 新しい技術スタックの習得がAIの支援で容易に

## テストとQA

AIはテストの自動生成においても大きな力を発揮しています。エッジケースの発見やリグレッションテストの作成が自動化され、品質保証のプロセスが効率化されています。

## 今後の展望

AIの能力が向上するにつれ、開発者の役割はコードを書くことからシステム全体の設計と意思決定へとシフトしていくでしょう。人間の創造性とAIの処理能力が融合した新しい開発パラダイムが生まれつつあります。

## まとめ

生成AIは開発者を置き換えるのではなく、開発者の能力を拡張するツールです。この変化に適応し、AIと効果的に協働できるスキルを身につけることが、これからのエンジニアに求められています。""",
        "category_ids": ["technology"],
        "tags": ["AI", "ソフトウェア開発", "生成AI", "プログラミング"],
        "pricing": {"type": "free", "price_jpy": 0, "currency": "JPY"},
        "creator_index": 0,
        "audio_completed": True,
        "duration_seconds": 480,
    },
    {
        "title": "スタートアップのプロダクトマーケットフィット完全ガイド",
        "slug": "startup-product-market-fit-guide",
        "excerpt": "PMFの達成はスタートアップの成否を分ける最重要マイルストーンです。PMFの定義から測定方法、達成までのフレームワークを体系的に解説します。",
        "body_markdown": """# スタートアップのプロダクトマーケットフィット完全ガイド

## PMFとは何か

プロダクトマーケットフィット（PMF）とは、製品が市場のニーズに合致している状態を指します。Marc Andreessenの言葉を借りれば、「PMFに達したかどうかは、常に感じ取れる」ものです。

## PMFの測定方法

### Sean Ellisテスト

最も広く使われている指標は、「この製品が使えなくなったら、どう感じますか？」という質問です。「非常に残念」と答えるユーザーが40%以上いれば、PMFに近いとされています。

### 定量指標

- **リテンション率**: 月次リテンション率が業界平均を上回っているか
- **NPS**: Net Promoter Scoreが50以上か
- **オーガニック成長**: 口コミによる自然な成長が見られるか
- **エンゲージメント**: DAU/MAU比率が健全な水準か

## PMF達成へのフレームワーク

### 1. 顧客発見

ターゲット顧客との対話を通じて、真のペインポイントを特定します。最低でも50人以上のインタビューを実施することを推奨します。

### 2. MVP開発

最小限の機能セットで仮説を検証します。完璧を求めず、学習速度を最大化することが重要です。

### 3. 反復と改善

データとフィードバックに基づいて、素早くイテレーションを回します。

## よくある失敗パターン

- 顧客の声を聞かずに機能を追加する
- 市場が小さすぎるニッチに固執する
- PMF前にスケールに投資する

## まとめ

PMFは一度達成すれば終わりではなく、市場の変化に合わせて継続的に維持・強化する必要があります。""",
        "category_ids": ["business"],
        "tags": ["スタートアップ", "PMF", "起業", "ビジネス戦略"],
        "pricing": {"type": "paid", "price_jpy": 500, "currency": "JPY"},
        "creator_index": 0,
        "audio_completed": True,
        "duration_seconds": 720,
    },
    {
        "title": "Kubernetes本番運用で学んだ10の教訓",
        "slug": "kubernetes-production-lessons-learned",
        "excerpt": "3年間のKubernetes本番運用で遭遇した課題と解決策を共有します。リソース管理、モニタリング、セキュリティなど、実践的な知見をまとめました。",
        "body_markdown": """# Kubernetes本番運用で学んだ10の教訓

## はじめに

Kubernetesを本番環境で3年間運用してきた経験から、最も重要な教訓を10個にまとめました。これからK8sを導入する方、運用で苦労している方の参考になれば幸いです。

## 教訓1: リソースリクエストとリミットは必ず設定する

リソースの設定を怠ると、ノードの過負荷やOOMKillが頻発します。すべてのPodにrequestsとlimitsを適切に設定しましょう。

## 教訓2: Readiness ProbeとLiveness Probeを適切に使い分ける

Liveness ProbeはPodの再起動を、Readiness Probeはトラフィックの制御を行います。混同するとデプロイ時の障害やカスケード障害の原因になります。

## 教訓3: Namespace戦略を早期に決める

チーム別、環境別、サービス別など、Namespaceの分割方針は早い段階で決めておくべきです。後からの変更は非常にコストがかかります。

## 教訓4: モニタリングは最初から投資する

Prometheus + Grafanaの組み合わせは定番ですが、ログ収集（Loki/EFK）とトレーシング（Jaeger/Tempo）も含めた可観測性スタックを初期から構築することを強く推奨します。

## 教訓5: GitOpsを採用する

ArgoCD やFlux を使ったGitOpsにより、デプロイの再現性と監査性が大幅に向上します。手動kubectlは事故のもとです。

## 教訓6〜10

（続きは音声でお聴きください）

Pod Security Standards、NetworkPolicy、バックアップ戦略、コスト最適化、そしてチーム教育について詳しく解説しています。

## まとめ

Kubernetesは強力なプラットフォームですが、正しく運用するには深い知識と経験が必要です。この記事が皆さんの運用をより良いものにする一助となれば幸いです。""",
        "category_ids": ["technology"],
        "tags": ["Kubernetes", "インフラ", "DevOps", "クラウド"],
        "pricing": {"type": "paid", "price_jpy": 800, "currency": "JPY"},
        "creator_index": 0,
        "audio_completed": False,
        "duration_seconds": None,
    },
    {
        "title": "リモートワーク時代のチームマネジメント術",
        "slug": "remote-work-team-management",
        "excerpt": "フルリモート環境でチームの生産性とエンゲージメントを維持するための実践的な手法を紹介します。非同期コミュニケーションの設計から1on1の進め方まで。",
        "body_markdown": """# リモートワーク時代のチームマネジメント術

## 非同期ファーストの文化を作る

リモートワークの最大の課題は、同期的なコミュニケーションへの依存です。チャットで即座に返答を求める文化は、深い集中作業を妨げます。

### 非同期コミュニケーションの原則

1. **ドキュメントを中心に据える**: 議事録、決定事項、設計文書はすべて文書化
2. **コンテキストを十分に提供する**: メッセージには背景情報を含める
3. **期待レスポンス時間を明確にする**: 緊急度に応じた返答期限を設定

## 効果的な1on1ミーティング

### 頻度とフォーマット

週1回30分のビデオ通話を基本とし、以下のアジェンダで進めます：

- 前回からのアップデート（5分）
- 現在の課題と支援が必要なこと（10分）
- キャリア開発と成長（10分）
- フリートーク（5分）

## チームの一体感を維持する

### バーチャルチームビルディング

- 月1回のオンラインランチ会
- 四半期ごとのオフサイトミーティング
- Slackでの雑談チャンネルの活性化

## 成果の可視化

リモート環境では、プロセスよりも成果で評価する文化への移行が不可欠です。OKRやKPIを活用し、チーム全体の目標と個人の貢献を明確にしましょう。

## まとめ

リモートワークは働き方の選択肢のひとつです。適切なツールとプロセスを整備し、信頼ベースのマネジメントを実践することで、オフィス以上の成果を出すことが可能です。""",
        "category_ids": ["business"],
        "tags": ["リモートワーク", "マネジメント", "チーム運営", "働き方"],
        "pricing": {"type": "free", "price_jpy": 0, "currency": "JPY"},
        "creator_index": 0,
        "audio_completed": True,
        "duration_seconds": 540,
    },
    {
        "title": "Next.js App Routerの設計パターン集",
        "slug": "nextjs-app-router-design-patterns",
        "excerpt": "Next.js 14以降のApp Routerを使った実践的な設計パターンを紹介します。Server Components、Streaming、Parallel Routesなど、最新機能の活用法をコード例とともに解説。",
        "body_markdown": """# Next.js App Routerの設計パターン集

## はじめに

Next.js App Routerは、React Server Componentsを基盤とした新しいルーティングシステムです。従来のPages Routerとは異なるメンタルモデルが必要になります。

## パターン1: Server/Client Componentの分離

### 原則

- デフォルトはServer Component
- インタラクティブな部分のみClient Componentに
- Client Componentは葉（leaf）ノードに配置

```tsx
// app/posts/[id]/page.tsx (Server Component)
export default async function PostPage({ params }) {
  const post = await getPost(params.id);
  return (
    <article>
      <h1>{post.title}</h1>
      <PostContent content={post.body} />
      <LikeButton postId={params.id} /> {/* Client Component */}
    </article>
  );
}
```

## パターン2: Streaming with Suspense

重い処理を持つコンポーネントをSuspenseで囲むことで、ページの初期表示を高速化できます。

```tsx
export default function Dashboard() {
  return (
    <div>
      <h1>ダッシュボード</h1>
      <Suspense fallback={<Skeleton />}>
        <Analytics />
      </Suspense>
      <Suspense fallback={<Skeleton />}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}
```

## パターン3: Parallel Routes

複数のコンテンツ領域を同時にレンダリングし、それぞれ独立したロード状態を持たせることができます。

## パターン4: Route Groups

URLに影響を与えずにルートをグループ化し、レイアウトを共有できます。認証が必要なページとパブリックなページを分けるのに便利です。

## パターン5: Data Fetching戦略

Server Componentでのfetchはデフォルトでキャッシュされます。revalidateの設定やcache: 'no-store'の使い分けが重要です。

## まとめ

App Routerは学習曲線がありますが、適切なパターンを理解すれば、より効率的でパフォーマンスの高いアプリケーションを構築できます。""",
        "category_ids": ["technology"],
        "tags": ["Next.js", "React", "フロントエンド", "Web開発"],
        "pricing": {"type": "paid", "price_jpy": 300, "currency": "JPY"},
        "creator_index": 0,
        "audio_completed": True,
        "duration_seconds": 600,
    },
    # ── 3 Japanese self-improvement articles ──
    {
        "title": "朝5時起きを1年続けてわかった5つのこと",
        "slug": "early-morning-routine-one-year",
        "excerpt": "早朝の時間を活用することで生産性が劇的に向上しました。朝型生活を1年間続けた実体験から得られた気づきと、習慣化のコツをお伝えします。",
        "body_markdown": """# 朝5時起きを1年続けてわかった5つのこと

## きっかけ

忙しい日常の中で自分の時間を確保するため、朝5時起きを始めました。最初の2週間は辛かったですが、1年経った今では完全に習慣化しています。

## 1. 朝の2時間は夜の4時間に匹敵する

朝の集中力は夜とは比べ物になりません。脳がフレッシュな状態で取り組む創造的な作業は、夜の2倍以上の効率で進みます。

### 私の朝ルーティン

- 5:00 起床、水を飲む
- 5:15 瞑想（10分）
- 5:30 読書または勉強（60分）
- 6:30 軽い運動（30分）
- 7:00 朝食、家族との時間

## 2. 意志力は消耗品である

行動科学の研究が示すように、意志力は1日を通じて減少していきます。朝一番に最も重要なタスクに取り組むことで、意志力が十分にある状態で質の高い仕事ができます。

## 3. 睡眠の質がすべてを決める

早起きの成功は、就寝時間の管理にかかっています。22時に就寝するためのナイトルーティンを確立することが最も重要でした。

### 良い睡眠のための習慣

- 21時以降はブルーライトを避ける
- カフェインは14時までに
- 寝室の温度は18-20度に保つ

## 4. 孤独な時間の価値

誰にも邪魔されない静かな朝の時間は、自己対話と内省の時間でもあります。この時間があることで、日中のストレスへの耐性が大幅に向上しました。

## 5. 継続は小さな成功から

完璧を求めず、まずは週3日から始めました。小さな成功体験を積み重ねることが、長期的な習慣化の鍵です。

## まとめ

朝型生活は万人に合うわけではありませんが、「自分の時間がない」と感じている方にはぜひ試していただきたい習慣です。""",
        "category_ids": ["self-improvement"],
        "tags": ["朝活", "習慣化", "生産性", "ライフハック"],
        "pricing": {"type": "free", "price_jpy": 0, "currency": "JPY"},
        "creator_index": 1,
        "audio_completed": True,
        "duration_seconds": 420,
    },
    {
        "title": "マインドフルネス瞑想の科学的根拠と実践法",
        "slug": "mindfulness-meditation-science-practice",
        "excerpt": "マインドフルネス瞑想の効果は多くの科学的研究で実証されています。脳科学の知見を踏まえた正しい実践方法と、日常に取り入れるためのステップを解説します。",
        "body_markdown": """# マインドフルネス瞑想の科学的根拠と実践法

## マインドフルネスとは

マインドフルネスとは、「今この瞬間に、判断を加えずに注意を向ける」心の状態です。仏教の瞑想に起源を持ちますが、現代では宗教色を排した形で広く実践されています。

## 科学的エビデンス

### 脳構造の変化

ハーバード大学の研究チームは、8週間のマインドフルネスプログラム（MBSR）後に、参加者の脳に構造的変化が見られることを発見しました。

- **海馬**: 学習と記憶に関わる領域が増大
- **扁桃体**: ストレス反応に関わる領域が縮小
- **前頭前皮質**: 注意力と意思決定に関わる領域が活性化

### ストレス軽減効果

メタ分析によると、マインドフルネス瞑想は：
- コルチゾール（ストレスホルモン）レベルを有意に低下
- 不安症状を約30%軽減
- うつ症状の再発リスクを約40%低減

## 初心者のための実践ガイド

### ステップ1: 呼吸瞑想（5分）

1. 楽な姿勢で座る
2. 目を軽く閉じる
3. 自然な呼吸に意識を向ける
4. 思考が浮かんだら、優しく呼吸に意識を戻す

### ステップ2: ボディスキャン（10分）

足先から頭頂まで、体の各部位に順番に意識を向けていきます。緊張やこわばりに気づいたら、呼吸とともに手放すイメージを持ちましょう。

### ステップ3: 日常への統合

- 食事中にマインドフルに味わう
- 歩行中に足の感覚に注意を向ける
- 会話中に相手の言葉に完全に注意を向ける

## よくある誤解

- 「頭を空っぽにする」必要はない
- 特別な場所や道具は不要
- 短い時間でも効果がある

## まとめ

マインドフルネスは筋トレと同じで、継続することで効果が蓄積されます。1日5分から始めて、心と脳の健康を育みましょう。""",
        "category_ids": ["self-improvement", "health"],
        "tags": ["マインドフルネス", "瞑想", "メンタルヘルス", "脳科学"],
        "pricing": {"type": "paid", "price_jpy": 500, "currency": "JPY"},
        "creator_index": 1,
        "audio_completed": True,
        "duration_seconds": 660,
    },
    {
        "title": "読書ノートの取り方 — 知識を定着させる技術",
        "slug": "reading-notes-knowledge-retention",
        "excerpt": "本を読んでも内容を忘れてしまう悩みを解決します。認知科学に基づいた読書ノートの取り方と、知識をアウトプットに繋げるためのシステムを紹介します。",
        "body_markdown": """# 読書ノートの取り方 — 知識を定着させる技術

## なぜ読書ノートが必要か

エビングハウスの忘却曲線によると、学んだ内容の約70%は24時間以内に忘れられます。読書ノートは、この忘却に抗うための最も効果的なツールです。

## 3ステップ読書ノート法

### ステップ1: マーキング読み

初読時は気になった箇所にマーカーや付箋を付けるだけにします。流れを止めずに読み進めることが重要です。

### ステップ2: 抽出と要約

読了後、マーキングした箇所を読み返し、以下の3つのカテゴリに分類します：

1. **ファクト**: 客観的な事実やデータ
2. **インサイト**: 著者の独自の視点や分析
3. **アクション**: 自分が実践できること

### ステップ3: 自分の言葉で再構成

抽出した内容を、自分の言葉で書き直します。これが最も重要なステップです。

## おすすめのツール

### アナログ派

- **Zettelkasten法**: カード式のメモシステム。関連するカード同士をリンクさせることで、知識のネットワークを構築
- **読書日記**: 日付、書名、感想を記録するシンプルな方法

### デジタル派

- **Obsidian**: マークダウンベースのノートアプリ。双方向リンクが強力
- **Notion**: データベース機能で読書リストと感想を一元管理

## アウトプットに繋げる

読書ノートを書くだけでは不十分です。以下の方法で知識をアウトプットに繋げましょう：

- ブログやSNSで要約を共有
- 読書会で議論する
- 実務に応用してみる

## まとめ

読書の目的は知識を得ることだけではなく、その知識を使って行動を変えることです。読書ノートはそのための橋渡し役を果たします。""",
        "category_ids": ["self-improvement", "education"],
        "tags": ["読書", "ノート術", "学習法", "知的生産"],
        "pricing": {"type": "paid", "price_jpy": 300, "currency": "JPY"},
        "creator_index": 1,
        "audio_completed": False,
        "duration_seconds": None,
    },
    # ── 2 English articles ──
    {
        "title": "Building Scalable APIs with FastAPI and Firebase",
        "slug": "building-scalable-apis-fastapi-firebase",
        "excerpt": "Learn how to build production-ready APIs using FastAPI and Firebase. This guide covers authentication, Firestore data modeling, and deployment strategies for scalable applications.",
        "body_markdown": """# Building Scalable APIs with FastAPI and Firebase

## Introduction

FastAPI has emerged as one of the most popular Python web frameworks, combining the speed of Starlette with the data validation power of Pydantic. When paired with Firebase, it creates a powerful stack for building modern APIs.

## Setting Up the Project

### Project Structure

```
backend/
├── app/
│   ├── api/v1/endpoints/
│   ├── core/
│   ├── services/
│   └── schemas/
├── tests/
└── scripts/
```

### Firebase Integration

Firebase Admin SDK provides server-side access to Firebase services. Initialize it early in your application lifecycle:

```python
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)
db = firestore.AsyncClient()
```

## Authentication Middleware

Firebase Authentication tokens can be verified on each request using a dependency:

```python
async def get_current_user(token: str = Depends(oauth2_scheme)):
    decoded = auth.verify_id_token(token)
    return decoded
```

## Firestore Data Modeling

### Denormalization Strategy

Unlike SQL databases, Firestore works best with denormalized data. Embed frequently accessed data directly in documents to minimize reads.

### Subcollections vs. Root Collections

Use subcollections for data that is always accessed in the context of a parent document. Use root collections for data that needs independent querying.

## Performance Optimization

- Use batch writes for multiple document updates
- Implement cursor-based pagination instead of offset
- Cache frequently accessed data with TTL
- Use composite indexes for complex queries

## Deployment

Deploy to Cloud Run for automatic scaling and pay-per-use pricing. Combine with Cloud Build for CI/CD pipelines.

## Conclusion

FastAPI and Firebase together provide a productive and scalable foundation for modern APIs. The key is understanding Firestore's strengths and designing your data model accordingly.""",
        "category_ids": ["technology", "education"],
        "tags": ["FastAPI", "Firebase", "Python", "API Design"],
        "pricing": {"type": "free", "price_jpy": 0, "currency": "JPY"},
        "creator_index": 0,
        "audio_completed": True,
        "duration_seconds": 540,
    },
    {
        "title": "The Art of Deep Work in a Distracted World",
        "slug": "deep-work-distracted-world",
        "excerpt": "In an age of constant notifications and context switching, the ability to focus deeply has become a rare and valuable skill. This article explores practical strategies for cultivating deep work habits.",
        "body_markdown": """# The Art of Deep Work in a Distracted World

## What is Deep Work?

Cal Newport defines deep work as "professional activities performed in a state of distraction-free concentration that push your cognitive capabilities to their limit." In contrast, shallow work refers to logistical tasks that can be performed while distracted.

## The Economics of Attention

### The Attention Economy

Tech companies compete for our attention because it directly translates to revenue. The average knowledge worker checks email 74 times per day and switches tasks every 3 minutes.

### The Cost of Context Switching

Research from the University of California, Irvine shows that it takes an average of 23 minutes to fully regain focus after an interruption. In an 8-hour workday with frequent interruptions, productive deep work time can shrink to less than 2 hours.

## Strategies for Deep Work

### 1. Time Blocking

Dedicate specific blocks of time to deep work. Start with 90-minute sessions and gradually extend as your concentration muscle strengthens.

### 2. The Shutdown Ritual

Create a clear boundary between work and rest. A shutdown ritual — reviewing tomorrow's tasks, closing all tabs, saying "schedule shutdown complete" — signals to your brain that work is done.

### 3. Digital Minimalism

- Remove social media apps from your phone
- Use website blockers during deep work sessions
- Batch email checking to 2-3 times per day
- Turn off all non-essential notifications

### 4. Environment Design

- Designate a specific space for deep work
- Use noise-canceling headphones
- Keep your workspace clean and distraction-free

## Building the Habit

Deep work is a skill that improves with practice. Like physical training, start small and progressively increase the intensity:

- Week 1-2: One 60-minute deep work session per day
- Week 3-4: Two 90-minute sessions per day
- Month 2+: Three or more hours of deep work daily

## The Craftsman Mindset

Adopting a craftsman mindset means focusing on the value you produce rather than the value you consume. Deep work is the engine that powers this production.

## Conclusion

In a world that increasingly rewards shallow busyness, the ability to do deep work is both rare and valuable. By intentionally designing your days around focused work, you can produce results that set you apart.""",
        "category_ids": ["self-improvement"],
        "tags": ["Deep Work", "Productivity", "Focus", "Self-Improvement"],
        "pricing": {"type": "paid", "price_jpy": 1000, "currency": "JPY"},
        "creator_index": 1,
        "audio_completed": False,
        "duration_seconds": None,
    },
]
# ────────────────────────────────────────────────────


def _random_past_datetime(days_back_min=7, days_back_max=90):
    """Return a random UTC datetime within the given range in the past."""
    delta = timedelta(days=random.randint(days_back_min, days_back_max),
                      hours=random.randint(0, 23),
                      minutes=random.randint(0, 59))
    return datetime.now(timezone.utc) - delta


def _generate_stats(is_paid, audio_completed):
    """Generate realistic-looking stats."""
    play_count = random.randint(10, 5000) if audio_completed else random.randint(0, 5)
    view_count = play_count + random.randint(50, 2000)
    completion_count = int(play_count * random.uniform(0.3, 0.8)) if audio_completed else 0
    purchase_count = random.randint(5, 200) if is_paid else 0
    average_rating = round(random.uniform(3.5, 5.0), 1)
    review_count = random.randint(2, 50)
    total_revenue = purchase_count * random.randint(300, 1000) if is_paid else 0

    return {
        "view_count": view_count,
        "play_count": play_count,
        "completion_count": completion_count,
        "purchase_count": purchase_count,
        "average_rating": average_rating,
        "review_count": review_count,
        "total_revenue": total_revenue,
    }


def main():
    # ── Initialize Firebase ──────────────────────────
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "demo-audio-blog")
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")

    if sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
    else:
        cred = credentials.ApplicationDefault() if not os.environ.get("FIRESTORE_EMULATOR_HOST") else None

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred, {
            "projectId": project_id,
            "storageBucket": f"{project_id}.appspot.com",
        })

    db = firestore.client()
    now = datetime.now(timezone.utc)

    # ── Look up admin user ───────────────────────────
    try:
        admin_record = auth.get_user_by_email(ADMIN_EMAIL)
        admin_uid = admin_record.uid
        print(f"Found admin user: {admin_uid}")
    except auth.UserNotFoundError:
        print("WARNING: Admin user not found. Run seed_admin.py first.")
        print("         Transactions and purchases will be skipped.")
        admin_uid = None

    # ── Create creator users ─────────────────────────
    creator_uids = []
    for creator in CREATORS:
        try:
            user_record = auth.get_user_by_email(creator["email"])
            print(f"Creator already exists: {user_record.uid} ({creator['email']})")
        except auth.UserNotFoundError:
            user_record = auth.create_user(
                email=creator["email"],
                password=creator["password"],
                display_name=creator["display_name"],
                email_verified=True,
            )
            print(f"Created creator: {user_record.uid} ({creator['email']})")

        # Set creator custom claims
        auth.set_custom_user_claims(user_record.uid, {"role": "creator"})

        # Create/update Firestore profile
        user_doc = {
            "uid": user_record.uid,
            "email": creator["email"],
            "display_name": creator["display_name"],
            "avatar_url": None,
            "bio": creator["bio"],
            "role": "creator",
            "preferences": {
                "default_playback_speed": 1.0,
                "auto_play_next": True,
                "email_notifications": True,
                "push_notifications": False,
                "preferred_language": "ja",
            },
            "creator_profile": {
                "stripe_account_id": None,
                "stripe_onboarding_complete": False,
                "charges_enabled": False,
                "total_earnings": 0,
                "content_count": 0,
                "follower_count": random.randint(10, 500),
                "verified_at": now,
            },
            "created_at": now - timedelta(days=random.randint(60, 180)),
            "updated_at": now,
            "last_login_at": now - timedelta(hours=random.randint(1, 48)),
            "is_active": True,
            "is_suspended": False,
            "suspended_reason": None,
        }
        db.collection("users").document(user_record.uid).set(user_doc, merge=True)
        creator_uids.append(user_record.uid)

    print(f"\nCreated/updated {len(creator_uids)} creator users")

    # ── Create sample content ────────────────────────
    content_ids = []
    paid_content_ids = []

    for idx, content in enumerate(SAMPLE_CONTENTS):
        creator_uid = creator_uids[content["creator_index"]]
        creator_name = CREATORS[content["creator_index"]]["display_name"]
        is_paid = content["pricing"]["type"] == "paid"
        published_at = _random_past_datetime(7, 60)

        audio_info = {
            "status": "none",
            "audio_url": None,
            "duration_seconds": None,
            "file_size_bytes": None,
            "format": "mp3",
            "tts_voice": None,
            "tts_job_id": None,
            "generated_at": None,
        }

        if content["audio_completed"]:
            audio_info = {
                "status": "completed",
                "audio_url": f"gs://{project_id}.appspot.com/audio/{content['slug']}.mp3",
                "duration_seconds": content["duration_seconds"],
                "file_size_bytes": content["duration_seconds"] * 16000,  # ~128kbps MP3
                "format": "mp3",
                "tts_voice": "ja-JP-Neural2-B" if idx < 8 else "en-US-Neural2-J",
                "tts_job_id": str(uuid.uuid4()),
                "generated_at": published_at + timedelta(minutes=random.randint(5, 30)),
            }

        doc_data = {
            "creator_id": creator_uid,
            "creator_display_name": creator_name,
            "title": content["title"],
            "slug": content["slug"],
            "excerpt": content["excerpt"],
            "body_markdown": content["body_markdown"],
            "body_html": f"<p>{content['excerpt']}</p>",  # Simplified; real HTML from markdown
            "thumbnail_url": None,
            "audio": audio_info,
            "category_ids": content["category_ids"],
            "tags": content["tags"],
            "series_id": None,
            "series_order": None,
            "pricing": content["pricing"],
            "stats": _generate_stats(is_paid, content["audio_completed"]),
            "status": "published",
            "published_at": published_at,
            "scheduled_at": None,
            "seo": {
                "meta_title": content["title"],
                "meta_description": content["excerpt"][:160],
                "og_image_url": None,
            },
            "created_at": published_at - timedelta(days=random.randint(1, 5)),
            "updated_at": published_at + timedelta(days=random.randint(0, 10)),
            "current_version": 1,
            "is_deleted": False,
        }

        doc_ref = db.collection("contents").document()
        doc_ref.set(doc_data)
        content_id = doc_ref.id
        content_ids.append(content_id)

        if is_paid:
            paid_content_ids.append((content_id, content))

        # Save initial version in subcollection
        doc_ref.collection("versions").document("v1").set({
            "version": 1,
            "body_markdown": content["body_markdown"],
            "title": content["title"],
            "created_at": doc_data["created_at"],
            "created_by": creator_uid,
        })

        status_label = "🔊" if content["audio_completed"] else "📝"
        price_label = f"¥{content['pricing']['price_jpy']}" if is_paid else "FREE"
        print(f"  {status_label} [{price_label:>6}] {content['title'][:50]}")

    print(f"\nCreated {len(content_ids)} content items")

    # ── Update creator content counts ────────────────
    for i, creator_uid in enumerate(creator_uids):
        count = sum(1 for c in SAMPLE_CONTENTS if c["creator_index"] == i)
        db.collection("users").document(creator_uid).update({
            "creator_profile.content_count": count,
        })

    # ── Create sample transactions and purchases for admin ──
    tx_count = 0
    purchase_count = 0

    if admin_uid and paid_content_ids:
        print("\nCreating sample transactions and purchases for admin user...")

        # Pick up to 3 paid contents for the admin to have "purchased"
        purchased_items = paid_content_ids[:3]

        for content_id, content_data in purchased_items:
            creator_uid = creator_uids[content_data["creator_index"]]
            price = content_data["pricing"]["price_jpy"]
            platform_fee = int(price * 0.20)
            stripe_fee = int(price * 0.036)
            seller_earnings = price - platform_fee
            purchased_at = _random_past_datetime(1, 30)

            # Transaction record
            tx_ref = db.collection("transactions").document()
            tx_ref.set({
                "buyer_id": admin_uid,
                "seller_id": creator_uid,
                "content_id": content_id,
                "type": "purchase",
                "amount": price,
                "currency": "JPY",
                "platform_fee": platform_fee,
                "stripe_fee": stripe_fee,
                "seller_earnings": seller_earnings,
                "stripe_payment_intent_id": f"pi_seed_{uuid.uuid4().hex[:16]}",
                "stripe_charge_id": f"ch_seed_{uuid.uuid4().hex[:16]}",
                "status": "completed",
                "created_at": purchased_at,
                "completed_at": purchased_at,
            })
            tx_count += 1

            # Purchase record (subcollection of user)
            db.collection("users").document(admin_uid).collection("purchases").document(content_id).set({
                "purchase_id": tx_ref.id,
                "content_id": content_id,
                "transaction_id": tx_ref.id,
                "content_title": content_data["title"],
                "content_thumbnail_url": None,
                "creator_id": creator_uid,
                "creator_display_name": CREATORS[content_data["creator_index"]]["display_name"],
                "price_jpy": price,
                "purchased_at": purchased_at,
                "access_granted": True,
                "access_revoked_at": None,
            })
            purchase_count += 1

            print(f"  Purchase: {content_data['title'][:40]} (¥{price})")

    # ── Print summary ────────────────────────────────
    print("\n" + "=" * 60)
    print("Seed content complete!")
    print("=" * 60)
    print(f"  Creators:      {len(creator_uids)}")
    for i, c in enumerate(CREATORS):
        print(f"    - {c['display_name']} ({c['email']}) [{creator_uids[i]}]")
    print(f"  Content items: {len(content_ids)}")
    free_count = sum(1 for c in SAMPLE_CONTENTS if c["pricing"]["type"] == "free")
    paid_count = len(SAMPLE_CONTENTS) - free_count
    audio_count = sum(1 for c in SAMPLE_CONTENTS if c["audio_completed"])
    print(f"    - Free: {free_count}, Paid: {paid_count}")
    print(f"    - With audio: {audio_count}, Without audio: {len(SAMPLE_CONTENTS) - audio_count}")
    print(f"  Transactions:  {tx_count}")
    print(f"  Purchases:     {purchase_count}")
    print("=" * 60)
    print("\nCreator passwords: Creator@2026!")


if __name__ == "__main__":
    main()
