# イベキャッチ（ibekiatch）

キッチンカー・移動販売・露天営業者向けに、出店場所の募集情報を **AIが自動収集して通知する** Webアプリ。

- **Production**: https://ibekiatch.vercel.app
- **展開**: 三重県から全国（推定ターゲット 2〜3万台）

## ビジネスモデル

### サービス概要

出店場所の募集情報を複数ソース（13 batch）から1時間ごとに自動収集し、出店者に届ける。

### 収益3本柱

1. **ユーザーサブスク** — スタンダード ¥1,200/月 · プレミアム ¥2,980/月
2. **主催者掲載課金** — イベント主催者からの出店者募集掲載費
3. **スポンサー広告** — 包材屋・POSレジ・キッチンカー制作・保険など

### 監視ソース（13 batch · 東海4県中心）

こくちーず · Peatix · ジモティー · イベントバンク · 三重市町村HP · 商工会HP · 道の駅HP · まいぷれ三重 · キッチンカー出店マッチング（mellow / mobimaru / 窓口） · イオンモール · アウトレット · 三重観光 · JA三重 · X · Instagram

※ ニュース系（Googleニュース・新聞・FM 等）は古い／無関係な記事が混入するため除外済み。詳細は [監視ジョブ設定](docs/MONITOR_SETUP.md)。

→ [Stripe 課金セットアップ](docs/STRIPE_SETUP.md)（スタンダード / プレミアム）

→ [cron-job.org](https://cron-job.org) から `/api/cron/monitor` を1時間ごとに実行（[セットアップ](docs/MONITOR_SETUP.md)）

### コミュニティ

出店済みイベントへのレビュー・評価・情報共有・ユーザー同士の繋がり

## 機能

- **ホーム**: AI収集の新着 + 主催者掲載の募集
- **カレンダー**: 応募済み出店予定
- **通知**: 応募・システム・コミュニティ
- **コミュニティ**: 投稿・★レビュー
- **マイページ**: プラン · プロフィール · 応募履歴

## 開発

```bash
npm install
npm run dev
```

## 本番デプロイ

Vercel 環境変数:

| 変数 | 用途 |
|------|------|
| `VITE_SUPABASE_URL` | フロント / API |
| `VITE_SUPABASE_ANON_KEY` | フロント |
| `SUPABASE_SERVICE_ROLE_KEY` | 監視ジョブ DB 書き込み |
| `MONITOR_CRON_TOKEN` | cron-job.org 認証 |

```bash
npm run build
npx vercel deploy --prod
```

## 関連ドキュメント

- [監視ジョブ設定](docs/MONITOR_SETUP.md)
- [確認メール設定](docs/AUTH_EMAIL_SETUP.md)
