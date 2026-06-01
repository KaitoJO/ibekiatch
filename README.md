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

### 方法 A: CLI で自動実行（推奨）

1. `.env.example` を `.env` にコピーし、次を設定:
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_ACCESS_TOKEN`（[Account → Access Tokens](https://supabase.com/dashboard/account/tokens)）
   - `SUPABASE_DB_PASSWORD`（プロジェクト作成時の DB パスワード）

2. マイグレーションをリモート DB に適用:

   ```bash
   npm run db:push
   ```

   `001_ibekiatch_workspace.sql` と `002_seed_recruitments.sql`、続けて `003_extended_features.sql` が順番に実行されます。

3. 適用状況の確認:

   ```bash
   npm run db:status
   ```

**初回のみ** `SUPABASE_ACCESS_TOKEN` の代わりに CLI ログインでも可:

```bash
npx supabase login
npm run db:push
```

### 方法 B: SQL Editor で手動実行

[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) の手順に従い、SQL Editor で 001 → 002 を実行してください。

## 開発

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開き、DevTools のモバイル表示（幅 390px 前後）で確認するのがおすすめです。

## ビルド

```bash
npm run build
npm run preview
```
