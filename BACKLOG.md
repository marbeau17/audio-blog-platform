# AudioBlog Platform バックログ詳細書

**作成日:** 2026-03-29
**ステータス:** 分析完了・実装優先度付け済み

---

## 1. 実装済み機能サマリー

### バックエンド (60 APIエンドポイント)
- 認証: 6 EP (Email/Password, Google OAuth, RBAC)
- コンテンツ: 9 EP (CRUD, バージョン管理, 公開/非公開)
- TTS: 7 EP (変換, ジョブ管理, プレビュー, ボイス一覧)
- ストリーミング: 5 EP (署名付きURL, チャプター, 再生位置, イベント)
- 決済: 6 EP (PaymentIntent, Webhook, 購入履歴, チップ, 返金)
- クリエイター: 6 EP (ダッシュボード, 分析, 収益, Stripe Connect)
- 管理者: 10 EP (ユーザー管理, モデレーション, TTS, システム)
- 共通: 7 EP (ヘルス, カテゴリ, 検索, アップロード, レポート)
- レビュー: 4 EP (CRUD)

### フロントエンド (23ページ, 13コンポーネント, 3フック)
- 公開: ホーム, ログイン, 登録, コンテンツ一覧/詳細, 検索, プレイリスト
- ユーザー: プロフィール, 購入履歴
- クリエイター: ダッシュボード, コンテンツ管理/作成/編集, バージョン, シリーズ, 分析, 収益, 出金, Stripe
- 管理者: ダッシュボード, ユーザー管理, モデレーション, TTSキュー

### テスト (276テスト全パス)
- ユニット: 149, 統合: 19, E2E: 10, モンキー: 98

---

## 2. 未実装バックログ (優先度順)

### Priority 1: 高 (ビジネスクリティカル)

| ID | 機能 | カテゴリ | 仕様書参照 | 詳細 |
|----|------|---------|-----------|------|
| B-001 | お気に入り機能 | Backend+Frontend | FR-LISTENER | API: POST/DELETE/GET /favorites/{contentId}, UI: ハートボタン+一覧ページ, Firestoreルール定義済み |
| B-002 | クリエイター昇格UI | Frontend | 2.3 | プロフィールページに「クリエイターになる」ボタン、申請フォーム(氏名,連絡先,規約同意) |
| B-003 | 通知システム | Backend+Frontend | 3.4 | notification_service.py, TTS完了/購入完了/出金通知, トースト通知UI |
| B-004 | 7日返金制限チェック | Backend | FR-PAY-012 | handle_refund()に日数検証追加、購入後7日超は拒否 |
| B-005 | Media Session API | Frontend | FR-PLAYER-001 | バックグラウンド再生、ロック画面コントロール対応 |

### Priority 2: 中 (UX改善)

| ID | 機能 | カテゴリ | 仕様書参照 | 詳細 |
|----|------|---------|-----------|------|
| B-006 | 再生履歴ページ | Frontend | FR-LISTENER | /history ページ、playback_positionsからの履歴表示 |
| B-007 | ボリュームスライダー | Frontend | FR-PLAYER-001 | AudioPlayerに音量スライダーUI追加（現在ミュートボタンのみ） |
| B-008 | カテゴリ選択UI | Frontend | FR-CMS-010 | コンテンツ作成/編集でカテゴリ選択ドロップダウン |
| B-009 | 公開予約スケジュール | Frontend+Backend | FR-CMS-002 | scheduled_atフィールド活用、UIで日時指定、バックエンドで自動公開 |
| B-010 | SEOメタ編集UI | Frontend | FR-CMS-002 | コンテンツ作成/編集でmeta_title/description/OGP編集フォーム |
| B-011 | TTS非同期ワーカー | Backend | FR-TTS-010 | Cloud Tasks/Celeryでジョブディスパッチ実装（現在TODOコメント） |
| B-012 | 429レート制限UI | Frontend | SEC | Retry-After表示、自動リトライロジック |
| B-013 | Apple認証 | Backend+Frontend | SEC-001 | Apple Sign-In対応 |
| B-014 | PDF売上エクスポート | Backend | FR-PAY-020 | /creator/earnings/export?format=pdf エンドポイント |

### Priority 3: 低 (将来改善)

| ID | 機能 | カテゴリ | 仕様書参照 | 詳細 |
|----|------|---------|-----------|------|
| B-015 | AWS Pollyフォールバック | Backend | 4.2 | TTS API障害時の代替プロバイダー |
| B-016 | MFA (多要素認証) | Backend+Frontend | SEC-001 | TOTP/SMSオプション |
| B-017 | モニタリング・アラート | Infra | 4.2 | Prometheus/Grafana/Cloud Monitoring |
| B-018 | ディザスタリカバリ | Infra | 4.2 | Firestoreバックアップ、GCSバージョニング |
| B-019 | フロントエンドSentry | Frontend | 4.2 | @sentry/nextjs統合 |
| B-020 | CD自動デプロイ | Infra | - | GitHub Actions → Vercel/Cloud Run |

### Priority 4: テスト不足

| ID | テスト対象 | 種別 | 詳細 |
|----|-----------|------|------|
| T-001 | ReviewService | Unit | 作成/更新/削除/レーティング計算 |
| T-002 | お気に入り機能 | Unit+Integration | 追加/削除/一覧 |
| T-003 | 通知システム | Unit | 送信/取得/既読 |
| T-004 | AudioPlayer | Frontend | 再生制御、シーク、速度変更 |
| T-005 | ProtectedRoute | Frontend | 認証チェック、ロール階層 |
| T-006 | PaymentButton | Frontend | Stripe統合、エラー処理 |
| T-007 | SearchBar | Frontend | デバウンス、サジェスト |
| T-008 | MarkdownEditor | Frontend | ツールバー、プレビュー、自動保存 |

---

## 3. 実装完了率

| カテゴリ | 仕様要件数 | 実装済み | 完了率 |
|---------|-----------|---------|--------|
| CMS (FR-CMS) | 6 | 5 | 83% |
| TTS (FR-TTS) | 5 | 4 | 80% |
| Player (FR-PLAYER) | 4 | 3 | 75% |
| Payment (FR-PAY) | 6 | 5 | 83% |
| Security (SEC) | 14 | 11 | 79% |
| Admin | 7 | 6 | 86% |
| **全体** | **42** | **34** | **81%** |
