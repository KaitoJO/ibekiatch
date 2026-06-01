# Supabase セットアップ手順（ibekiatch）

キッチンカー事業者アカウント（メール＋パスワード）でログインし、出店募集の閲覧・応募・プロフィールをクラウドに保存するための手順です。

## 1. プロジェクトを作成

1. [Supabase](https://supabase.com/) にサインインし、「New project」でプロジェクトを作成します。
2. **Database password** は安全に保管してください（CLI の `SUPABASE_DB_PASSWORD` に使います）。

## 2. API キーをアプリに設定

1. Supabase ダッシュボードで **Project Settings（歯車）→ API** を開きます。
2. **Project URL** をコピーし、ローカルの `.env` に次のように設定します。

   ```env
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   ```

3. **Project API keys** の **`anon` `public`** キーをコピーし、次を設定します。

   ```env
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
   ```

4. 開発サーバーを再起動します（`npm run dev`）。

## 3. データベーステーブルと RLS を作成

### 方法 A: Supabase CLI（推奨・自動）

SQL Editor へのコピペは不要です。ローカルから次のコマンドでマイグレーションを適用します。

#### 3-1. CLI 用の環境変数を `.env` に追加

```env
# Personal Access Token（Dashboard → Account → Access Tokens）
SUPABASE_ACCESS_TOKEN=sbp_...

# プロジェクト作成時の Database password
SUPABASE_DB_PASSWORD=your-database-password
```

`VITE_SUPABASE_URL` が設定されていれば `SUPABASE_PROJECT_ID` は省略できます（URL から ref を自動抽出）。

#### 3-2. マイグレーション実行

```bash
npm install
npm run db:push
```

成功すると `001_ibekiatch_workspace.sql`（テーブル + RLS）と `002_seed_recruitments.sql`（サンプル 6 件）がリモート DB に適用されます。

#### 3-3. 適用状況の確認

```bash
npm run db:status
```

#### トークンを .env に書きたくない場合（初回のみ）

```bash
npx supabase login
npm run db:push
```

ログイン後は `~/.supabase/access-token` に認証情報が保存されます。`SUPABASE_DB_PASSWORD` は引き続き必要です。

---

### 方法 B: SQL Editor（手動）

1. ダッシュボードで **SQL Editor** を開きます。
2. **New query** をクリックします。
3. `supabase/migrations/001_ibekiatch_workspace.sql` の**全文**をコピーして貼り付け、**Run** します。
4. 新しいクエリを開き、`supabase/migrations/002_seed_recruitments.sql` を同様に **Run** します。

   **必ず 001 → 002 の順番**で実行してください。

## 4. 認証（メール＋パスワード）の設定

1. **Authentication → Providers** で **Email** が有効になっていることを確認します。
2. 開発中にメール確認なしで試す場合: **Authentication → Providers → Email** で **Confirm email** をオフにできます。
3. **Authentication → URL Configuration** で、本番サイトの URL を **Site URL** に追加します（ローカルは `http://localhost:5173`）。

## 5. 動作確認

1. アプリを開き、「新規登録」でメールアドレスとパスワードを登録します。
2. ログイン後、ホームに出店募集カードが表示されることを確認します。
3. 「応募する」で応募し、マイページの応募数が増えることを確認します。
4. ブラウザのサイトデータを消去して再度ログインし、**同じアカウントでデータが残っている**ことを確認します。

## 6. 本番（例: Vercel）へのデプロイ

1. Vercel の **Environment Variables** に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を設定します。
2. 再デプロイ後、Supabase の **Authentication → URL Configuration** に本番ドメインを追加します。
3. 本番 DB へのマイグレーションも `npm run db:push` で適用できます（`.env` の URL / トークン / パスワードを本番プロジェクト向けに切り替え）。

## トラブルシューティング

| 現象 | 確認すること |
|------|----------------|
| `npm run db:push` で Access token not provided | `SUPABASE_ACCESS_TOKEN` を設定するか `npx supabase login` |
| DB password プロンプトが出る | `.env` に `SUPABASE_DB_PASSWORD` を設定 |
| `relation already exists` | 001 は適用済み。`npm run db:status` で確認 |
| ログイン直後に permission denied | 001 が最後まで実行されているか（RLS ポリシー含む） |
| 募集が 0 件 | 002 が適用されているか Table Editor で確認 |
| SQL Editor で手動実行済み + CLI も使いたい | `supabase migration repair` で履歴を整合させる必要がある場合あり |

## セキュリティメモ

- **サービスロールキー（`service_role`）はフロントエンドに書かないでください。**
- `SUPABASE_ACCESS_TOKEN` と `SUPABASE_DB_PASSWORD` は `.env` にのみ置き、Git にコミットしないでください。
- 応募データは個人情報にあたる場合があります。プロジェクトのアクセス権限を適切に管理してください。
