# 確認メール（SMTP）セットアップ

ibekiatch では **新規登録時にメール確認** を必須にしています。  
Supabase 標準メールは届きにくいため、**Resend** の SMTP を使います。

## クイックセットアップ（CLI 推奨）

```bash
# 1. Resend で API キーを取得 → .env に追加
#    RESEND_API_KEY=re_...
#    RESEND_SENDER_EMAIL=onboarding@resend.dev  # テスト用

# 2. Supabase に SMTP を反映
npm run auth:smtp
```

`supabase/config.toml` の SMTP 設定と確認メールテンプレートがリモートに push されます。

## 1. Resend で API キーを取得

1. [Resend](https://resend.com/signup) に登録（GitHub 連携可）
2. [API Keys](https://resend.com/api-keys) からキーを作成（`re_` で始まる）
3. `.env` に設定:

   ```env
   RESEND_API_KEY=re_xxxxxxxx
   RESEND_SENDER_EMAIL=onboarding@resend.dev
   ```

### 送信元について

| モード | 送信元 | 届く宛先 |
|--------|--------|----------|
| テスト | `onboarding@resend.dev` | **Resend 登録メールアドレスのみ** |
| 本番 | `noreply@yourdomain.com` | 任意のユーザー（ドメイン verify 後） |

本番で全ユーザーに届けるには [Resend Domains](https://resend.com/domains) でドメインを verify し、`RESEND_SENDER_EMAIL` を変更してください。

## 2. 手動設定（Dashboard）

CLI を使わない場合:

1. [Supabase Dashboard](https://supabase.com/dashboard/project/emrvzqwqccakhifdmviu/settings/auth) → **SMTP Settings**
2. **Enable Custom SMTP** を ON
3. Host `smtp.resend.com` / Port `465` / User `resend` / Password = API キー

## 3. URL 設定（反映済み）

- **Site URL**: `https://ibekiatch.vercel.app`
- **Redirect URLs**: `https://ibekiatch.vercel.app/**`, `http://localhost:5173/**`

## 4. 動作確認

1. https://ibekiatch.vercel.app で新規登録
2. 確認メール画面が表示される
3. メール内リンクをタップ → アプリに戻り自動ログイン

Resend の [Logs](https://resend.com/emails) で送信状況を確認できます。

## トラブルシューティング

| 現象 | 対処 |
|------|------|
| メールが届かない | `npm run auth:smtp` 実行済みか、Resend Logs を確認 |
| テストで他アドレスに届かない | `onboarding@resend.dev` は登録メアドレス宛のみ。ドメイン verify が必要 |
| リンクを開いてもログインできない | Redirect URLs に本番 URL が入っているか確認 |
| 「Email not confirmed」 | 確認メールを再送、または Dashboard で手動 confirm |
