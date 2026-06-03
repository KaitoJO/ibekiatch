# 出店情報監視（スクレイピング）

キッチンカー・出店募集に関する情報を複数ソースから収集し、Supabase の `monitor_hits` テーブルに保存します。本番では [cron-job.org](https://cron-job.org) が1時間ごとに API を叩いて裏側で実行します。

## 監視キーワード

### Web一般（RSS・スクレイプ）

キッチンカー / 移動販売 / フードトラック / 出店募集 / マルシェ / 露天 / 出店者募集 / キッチンカー募集 / フード出店

### SNS（Playwright — X / Instagram）

キッチンカー募集 / 出店者募集 / マルシェ出店 / フードトラック募集 / 移動販売募集 / キッチンカー 出店 / マルシェ 募集

## 監視ソース（13 batch・ニュース系除外後）

`scripts/monitor/cronBatches.mjs` の `CRON_BATCHES` が唯一の定義元です。

| ID | ソース | 方式 |
|----|--------|------|
| kokuchiz | こくちーず | RSS |
| peatix | Peatix | RSS → スクレイプ |
| jmty | ジモティー | スクレイプ |
| eventbank | イベントバンク | スクレイプ |
| mie_cities | 三重 市町村公式HP | スクレイプ |
| shokokai | 商工会・商工会議所 | スクレイプ |
| michinoeki | 道の駅 | スクレイプ |
| maipure_mie | まいぷれ三重 | スクレイプ |
| mellow_shopstop / mobimaru | キッチンカー出店マッチング | スクレイプ |
| kitchencar_madoguchi / aeon_mall | キッチンカー窓口 / イオンモール | スクレイプ |
| outlet_mall / mie_tourism | アウトレット / 三重観光 | スクレイプ |
| ja_mie | JA三重 | スクレイプ |
| twitter | X | **Playwright**（公開投稿） |
| instagram | Instagram | **Playwright**（公開投稿） |

SNS はログイン不要の公開範囲のみ取得。ログインウォールが出た場合は skip されます。

### 監視対象外（除外済み）

ニュース系は古い・無関係な記事が大量混入するため `monitor_sources.enabled=false` で除外しています（`scripts/monitor/excludedSources.mjs`）。

```
google_news, chunichi, chunichi_biz, ise_shinbun, local_fm, news, mie_news, mie_fm
```

Threads / Facebook はコードは残存していますが cron からは外し、hits は自動 purge されます（Playwright cron 対象は twitter / instagram のみ）。

## Playwright セットアップ（ローカル）

```bash
npm install
npm run playwright:install   # Chromium ブラウザ
npm run monitor:social       # X / Instagram のみ
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

### cron-job.org（14ジョブ = 13 batch + events pipeline · 1リクエスト1〜2ソース）

`.env` の `MONITOR_CRON_TOKEN` を埋め込んだ URL 一覧:

```bash
npm run monitor:cron-urls
```

→ `docs/cron-job-urls.local.txt` に保存（git には含めない）

**一括登録（推奨）:** cron-job.org の Settings → API Keys → Display Key でキーを取得し:

```bash
CRON_JOB_ORG_API_KEY=... npm run monitor:cron-bootstrap
```

`scripts/cron-job-org-bootstrap.mjs` が 14 ジョブを REST API で作成します（短い URL + `x-monitor-token` ヘッダー）。

**既存ジョブの同期（ニュース除外後）:** 旧16ジョブ構成（google_news=batch 1, mie_news+mie_fm=batch 11）から13 batch構成へ移行するには:

```bash
CRON_JOB_ORG_API_KEY=... npm run monitor:cron-sync-news
```

`scripts/cron-job-org-sync-news.mjs` がニュース系2ジョブを `enabled=false` にし、残りジョブの batch 番号を新 `CRON_BATCHES` に詰め直します。

**手動登録時の注意:** cron-job.org の URL 欄は約 100 文字上限のため、トークン付き URL は切れます。代わりに:

- URL: `https://ibekiatch.vercel.app/api/cron/monitor?batch=N`（または `?pipeline=events`）
- Advanced → Request headers: `x-monitor-token: （MONITOR_CRON_TOKEN）`

| パラメータ | 内容 |
|-----------|------|
| `batch=0`〜`12` | ソースを1〜2個ずつ収集 |
| `pipeline=events` | AI 構造化 → `events` テーブル |
| `source=kokuchiz` | 単体ソース |

- Schedule: 毎時、**2分間隔**で batch 0→12→pipeline の順がおすすめ
- `maxDuration`: 60秒（Vercel）

**単体例:** `https://ibekiatch.vercel.app/api/cron/monitor?token=（.env参照）&source=kokuchiz`

## 関連ファイル

- `scripts/monitor/cronBatches.mjs` — `CRON_BATCHES` 定義（13 batch）
- `scripts/monitor/excludedSources.mjs` — 除外ニュースソース一覧
- `scripts/monitor/playwright-social.mjs` — X / Instagram スクレイパー
- `scripts/monitor/run.mjs` — オーケストレータ
- `api/cron/monitor.js` — cron-job.org エンドポイント
- `scripts/cron-job-org-sync-news.mjs` — 既存ジョブのニュース除外＋batch番号同期
