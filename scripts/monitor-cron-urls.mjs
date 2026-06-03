#!/usr/bin/env node
/**
 * cron-job.org 用 URL 一覧を出力（トークン込み）
 *
 *   npm run monitor:cron-urls
 *
 * → docs/cron-job-urls.local.txt にも保存（gitignore 対象）
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnvFile } from './monitor/lib.mjs'
import { formatCronJobUrlList } from './monitor/run.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...parseEnvFile(resolve(root, '.env')), ...process.env }

const baseUrl = env.APP_URL?.trim() || 'https://ibekiatch.vercel.app'
const token = env.MONITOR_CRON_TOKEN?.trim()

if (!token) {
  console.error('MONITOR_CRON_TOKEN が .env に未設定です')
  process.exit(1)
}

const output = formatCronJobUrlList(baseUrl, token)
console.log(output)

const outPath = resolve(root, 'docs/cron-job-urls.local.txt')
writeFileSync(outPath, `${output}\n`, 'utf8')
console.error(`\n✓ 書き出し: ${outPath}`)
