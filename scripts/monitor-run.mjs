#!/usr/bin/env node
/**
 * キッチンカー出店情報の監視ジョブ（CLI）
 *
 * 使い方:
 *   npm run monitor
 *   npm run monitor -- kokuchiz google_news
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnvFile } from './monitor/lib.mjs'
import { runMonitor } from './monitor/run.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fileEnv = parseEnvFile(resolve(root, '.env'))
for (const [k, v] of Object.entries(fileEnv)) {
  if (!process.env[k]) process.env[k] = v
}

const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
const dryRun =
  process.argv.includes('--dry-run') ||
  !(process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY)?.trim()

if (dryRun && !(process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY)?.trim()) {
  console.log('注意: SUPABASE_SERVICE_ROLE_KEY 未設定のため dry-run で実行します')
}

const { saved, results, errors } = await runMonitor({
  sources: args.length > 0 ? args : null,
  dryRun,
})

console.log(`\n完了: ${saved} 件保存 / ${results.length} ソース実行`)
if (errors.length) {
  console.log(`警告: ${errors.length} ソースでエラー`)
  process.exitCode = 1
}
