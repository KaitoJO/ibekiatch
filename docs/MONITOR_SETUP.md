# 出店情報監視（スクレイピング）

キッチンカー・出店募集に関する情報を複数ソースから収集し、Supabase の `monitor_hits` テーブルに保存します。**ユーザー向け UI はありません** — 本番では [cron-job.org](https://cron-job.org) が1時間ごとに API を叩いて裏側で実行します。

## 監視キーワード

- キッチンカー / 移動販売 / フードトラック / 出店募集 / マルシェ
- 露天 / 出店者募集 / キッチンカー募集 / フード出店

## 監視ソース（12）

| ID | ソース | 方式 |
|----|--------|------|
| kokuchiz | こくちーず | RSS |
| peatix | Peatix | RSS → スクレイプ fallback |
| google_news | Googleニュース | RSS |
| jmty | ジモティー | スクレイプ |
| twitter | X (Twitter) | API（任意） |
| instagram | Instagram | Graph API（任意） |
| facebook | Facebook | Graph API（任意） |
| mie_cities | 三重 市町村公式HP | スクレイプ |
| shokokai | 商工会・商工会議所 | スクレイプ |
| michinoeki | 道の駅 | スクレイプ |
| eventbank | イベントバンク | スクレイプ |
| maipure_mie | まいぷれ三重 | スクレイプ |

## 本番（cron-job.org — 1時間ごと）

### 1. Vercel 環境変数

Dashboard → Project → Settings → Environment Variables:

| 変数 | 必須 | 説明 |
|------|------|------|
| `VITE_SUPABASE_URL` | ✓ | Supabase プロジェクト URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | service_role キー |
| `MONITOR_CRON_TOKEN` | ✓ | 認証トークン（ランダム文字列） |
| `TWITTER_BEARER_TOKEN` | 任意 | X API |
| `META_ACCESS_TOKEN` | 任意 | Instagram / Facebook |
| `FACEBOOK_PAGE_IDS` | 任意 | カンマ区切りページ ID |

`MONITOR_CRON_TOKEN` は `openssl rand -hex 32` などで生成してください。

### 2. cron-job.org の設定

1. [cron-job.org](https://console.cron-job.org) にログイン
2. **Create cronjob** をクリック
3. 以下を設定:

| 項目 | 値 |
|------|-----|
| Title | ibekiatch monitor |
| URL | `https://ibekiatch.vercel.app/api/cron/monitor?token=YOUR_TOKEN` |
| Schedule | Every hour（または `0 * * * *`） |
| Request method | GET |

**認証方法（いずれか1つ）**

| 方法 | 設定 |
|------|------|
| クエリ（簡単） | URL に `?token=YOUR_TOKEN` を付ける |
| Bearer ヘッダー | Advanced → Header: `Authorization` = `Bearer YOUR_TOKEN` |
| カスタムヘッダー | Advanced → Header: `X-Monitor-Token` = `YOUR_TOKEN` |

`YOUR_TOKEN` は Vercel の `MONITOR_CRON_TOKEN` と同じ値にしてください。

4. **Create** で保存

### 3. 動作確認

```bash
curl "https://ibekiatch.vercel.app/api/cron/monitor?token=YOUR_TOKEN"
```

成功時:

```json
{ "ok": true, "saved": 12, "sourceCount": 12, ... }
```

トークン未設定・不一致は `401 Unauthorized`、Vercel 側で `MONITOR_CRON_TOKEN` 未設定は `503` になります。

## ローカル実行

```bash
npm run db:push          # 初回のみ
npm run monitor          # 全ソース
npm run monitor -- kokuchiz google_news
```

`.env` に `SUPABASE_SERVICE_ROLE_KEY` が必要です。

## データ構造

- **monitor_sources** — ソース定義と最終実行ステータス
- **monitor_hits** — ヒット記事（`source_id` + `external_id` で重複排除）

RLS: 認証ユーザーが SELECT 可能。INSERT は service_role のみ。

## 関連ファイル

- `api/cron/monitor.js` — 監視 API エンドポイント
- `scripts/monitor/run.mjs` — 監視コア（CLI / API 共通）
- `scripts/monitor-run.mjs` — CLI エントリ
- `scripts/monitor/lib.mjs` — RSS / スクレイプ / API
- `supabase/migrations/004_monitor.sql` — スキーマ
