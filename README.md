# ibekiatch

キッチンカー向け出店マッチングのスマホファースト Web アプリ（Vite + React + TypeScript + Supabase）。

## 機能

- 下部タブバー：ホーム / カレンダー / 通知 / コミュニティ / マイページ
- **認証**：メール＋パスワード（Supabase Auth）
- **ホーム**：出店募集のカード表示・エリア/ジャンル/キーワードフィルター・詳細画面・応募
- **カレンダー**：応募済み出店予定を月表示
- **通知**：応募・システム・コミュニティ通知（既読管理）
- **コミュニティ**：投稿・レビュー（★評価）
- **マイページ**：プロフィール編集・応募履歴・ログアウト
- オレンジ系のアプリライク UI

## Supabase セットアップ

1. `.env.example` を `.env` にコピーし、次を設定:
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD`（CLI 用）

2. `npm run db:push` でマイグレーション適用

3. **確認メール（SMTP）**: [docs/AUTH_EMAIL_SETUP.md](docs/AUTH_EMAIL_SETUP.md) を参照  
   新規登録時はメール確認必須です。Resend 等の SMTP 設定を推奨します。

## 開発

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開き、DevTools のモバイル表示（幅 390px 前後）で確認するのがおすすめです。

## 本番（Vercel）

- **Production URL**: https://ibekiatch.vercel.app
- **GitHub**: https://github.com/KaitoJO/ibekiatch
- **Vercel ダッシュボード**: https://vercel.com/kaitos-projects-f6bfe401/ibekiatch

環境変数（Vercel → Settings → Environment Variables）:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Supabase **Authentication → URL Configuration** に本番 URL を追加:

- Site URL: `https://ibekiatch.vercel.app`
- Redirect URLs: `https://ibekiatch.vercel.app/**`

再デプロイ:

```bash
npx vercel deploy --prod
```

