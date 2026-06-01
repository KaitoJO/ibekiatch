# 確認メール（SMTP）セットアップ

ibekiatch では **新規登録時にメール確認** を必須にしています。  
Supabase 標準メールは届きにくいため、**Resend** などの SMTP を設定することを推奨します。

## 1. Resend で API キーを取得（無料枠あり）

1. [Resend](https://resend.com/) に登録
2. **API Keys** からキーを作成
3. （任意）ドメインを verify すると `noreply@yourdomain.com` から送信可能  
   未設定の場合は Resend のテスト用送信元を利用

## 2. Supabase に SMTP を設定

1. [Supabase Dashboard](https://supabase.com/dashboard) → プロジェクト **emrvzqwqccakhifdmviu**
2. **Project Settings → Authentication → SMTP Settings**
3. **Enable Custom SMTP** を ON
4. 例（Resend）:

   | 項目 | 値 |
   |------|-----|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | Resend の API キー |
   | Sender email | `onboarding@resend.dev`（テスト）または自ドメイン |
   | Sender name | `ibekiatch` |

5. **Save**

## 3. URL 設定（必須）

**Authentication → URL Configuration**

- **Site URL**: `https://ibekiatch.vercel.app`
- **Redirect URLs**:
  - `https://ibekiatch.vercel.app/**`
  - `http://localhost:5173/**`

## 4. メールテンプレート（任意）

**Authentication → Email Templates → Confirm signup**

件名例: `ibekiatch アカウント確認`

## 5. 動作確認

1. https://ibekiatch.vercel.app で新規登録
2. 確認メール画面が表示される
3. メール内リンクをタップ → アプリに戻り自動ログイン

## トラブルシューティング

| 現象 | 対処 |
|------|------|
| メールが届かない | SMTP 設定・迷惑メール・Resend の送信ログを確認 |
| リンクを開いてもログインできない | Redirect URLs に本番 URL が入っているか確認 |
| 「Email not confirmed」 | 確認メールを再送、または Dashboard でユーザーを手動 confirm |

## CLI で確認メールを有効化済み

```bash
npx supabase config push --yes
```

`supabase/config.toml` の `[auth.email] enable_confirmations = true` がリモートに反映されます。
