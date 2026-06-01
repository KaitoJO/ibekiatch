# 出店情報監視（スクレイピング）

キッチンカー・出店募集に関する情報を複数ソースから収集し、Supabase の `monitor_hits` テーブルに保存します。本番では [cron-job.org](https://cron-job.org) が1時間ごとに API を叩いて裏側で実行します。

## 監視キーワード

### Web一般（RSS・スクレイプ）

キッチンカー / 移動販売 / フードトラック / 出店募集 / マルシェ / 露天 / 出店者募集 / キッチンカー募集 / フード出店

### SNS（Playwright — X / Instagram / Threads）

キッチンカー募集 / 出店者募集 / マルシェ出店 / フードトラック募集 / 移動販売募集 / キッチンカー 出店 / マルシェ 募集

## 監視ソース

| ID | ソース | 方式 |
|----|--------|------|
| kokuchiz | こくちーず | RSS |
| peatix | Peatix | RSS → スクレイプ |
| google_news | Googleニュース | RSS |
| jmty | ジモティー | スクレイプ |
| twitter | X | **Playwright**（公開投稿） |
| instagram | Instagram | **Playwright**（公開投稿） |
| threads | Threads | **Playwright**（公開投稿） |
| mie_cities | 三重 市町村公式HP | スクレイプ |
| shokokai | 商工会・商工会議所 | スクレイプ |
| michinoeki | 道の駅 | スクレイプ |
| eventbank | イベントバンク | スクレイプ |
| maipure_mie | まいぷれ三重 | スクレイプ |

SNS はログイン不要の公開範囲のみ取得。ログインウォールが出た場合は skip されます。

## Playwright セットアップ（ローカル）

```bash
npm install
npm run playwright:install   # Chromium ブラウザ
npm run monitor:social       # X / Instagram / Threads のみ
npm run monitor              # 全ソース
```

Vercel 本番では `@sparticuz/chromium` を使用（サーバーレス用 Chromium）。

## 本番（cron-job.org — 1時間ごと）

### Vercel 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `VITE_SUPABASE_URL` | ✓ | Supabase プロジェクト URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | service_role キー |
| `MONITOR_CRON_TOKEN` | ✓ | 認証トークン |

### cron-job.org

- URL: `https://ibekiatch.vercel.app/api/cron/monitor?token=YOUR_TOKEN`
- Schedule: Every hour

> SNS Playwright は処理時間が長いため、Vercel Pro + `maxDuration: 300` 推奨。

## 関連ファイル

- `scripts/monitor/playwright-social.mjs` — X / Instagram / Threads スクレイパー
- `scripts/monitor/run.mjs` — オーケストレータ
- `api/cron/monitor.js` — cron-job.org エンドポイント
- `supabase/migrations/005_social_playwright.sql` — Threads ソース追加
