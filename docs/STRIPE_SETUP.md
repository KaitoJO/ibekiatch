# Stripe 課金セットアップ

イベキャッチの月額プラン（スタンダード ¥1,200 / プレミアム ¥2,980）を Stripe で受け付けます。

## 1. Stripe ダッシュボード

1. [Stripe Dashboard](https://dashboard.stripe.com/) でアカウント作成
2. **テストモード** で開発 → 本番公開前に **Live モード** に切り替え

## 2. Product / Price 作成（CLI）

```bash
# .env に STRIPE_SECRET_KEY=sk_test_... を設定
npm run stripe:setup
```

`.env` に `STRIPE_PRICE_STANDARD` / `STRIPE_PRICE_PREMIUM` が追記されます。

## 3. Webhook 設定

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. **Endpoint URL**: `https://ibekiatch.vercel.app/api/stripe/webhook`
3. **Events**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. 署名シークレット `whsec_...` をコピー

## 4. Vercel 環境変数

| 変数 | 説明 |
|------|------|
| `STRIPE_SECRET_KEY` | `sk_test_...` または `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook 署名シークレット |
| `STRIPE_PRICE_STANDARD` | スタンダード Price ID |
| `STRIPE_PRICE_PREMIUM` | プレミアム Price ID |
| `APP_URL` | `https://ibekiatch.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook が profiles を更新するため必須 |

## 5. Supabase マイグレーション

```bash
npm run db:push
```

`007_stripe_billing.sql` で Stripe 関連カラムと課金フィールド保護トリガーが追加されます。

## 6. Customer Portal（プラン変更・解約）

Stripe Dashboard → **Settings → Billing → Customer portal** を有効化してください。

## 7. 動作確認（テストモード）

1. https://ibekiatch.vercel.app にログイン
2. マイページ → **このプランにする**
3. テストカード `4242 4242 4242 4242` / 任意の未来日 / 任意 CVC
4. 完了後、AI収集が全件表示されることを確認

## 本番切り替えチェックリスト

- [ ] Stripe を Live モードに切り替え
- [ ] Live 用 API キーで `npm run stripe:setup` を再実行
- [ ] Live Webhook エンドポイントを登録
- [ ] Vercel 環境変数を Live 用に更新
- [ ] Customer Portal を Live で有効化
- [ ] 事業者情報・返金ポリシー等（Stripe / 特商法）を整備

## トラブルシューティング

| 現象 | 対処 |
|------|------|
| Checkout が 503 | `STRIPE_PRICE_*` が Vercel に未設定 |
| 支払い後も free のまま | Webhook URL / `STRIPE_WEBHOOK_SECRET` を確認 |
| プラン変更できない | Customer Portal を Dashboard で有効化 |
