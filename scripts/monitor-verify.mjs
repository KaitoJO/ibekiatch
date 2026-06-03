#!/usr/bin/env node
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAdminSupabase, parseEnvFile } from './monitor/lib.mjs'
import {
  isRecruitmentPost,
  isAcceptableMonitorUrl,
  sanitizeMonitorItem,
} from './monitor/urlUtils.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fileEnv = parseEnvFile(resolve(root, '.env'))
for (const [k, v] of Object.entries(fileEnv)) {
  if (!process.env[k]) process.env[k] = v
}

const supabase = getAdminSupabase()
const { data, error } = await supabase
  .from('monitor_hits')
  .select('id, source_id, title, url, snippet, matched_keywords, created_at')
  .order('created_at', { ascending: false })
  .limit(50)

if (error) throw error

const issues = []
const bySource = {}
for (const row of data ?? []) {
  bySource[row.source_id] = (bySource[row.source_id] ?? 0) + 1
}

for (const row of data ?? []) {
  if (row.source_id === 'threads') {
    issues.push({ type: 'threads', title: row.title?.slice(0, 80) })
    continue
  }
  if (!sanitizeMonitorItem(row)) {
    issues.push({ type: 'invalid_item', source: row.source_id, title: row.title?.slice(0, 80) })
    continue
  }
  if (row.url && !isAcceptableMonitorUrl(row.url)) {
    issues.push({ type: 'bad_url', source: row.source_id, url: row.url })
  }
}

console.log('=== monitor_hits 直近50件（URL/形式チェック）===')
console.log('ソース別:', bySource)
console.log('形式上の問題:', issues.length)

if (process.env.ANTHROPIC_API_KEY?.trim()) {
  console.log('\n=== AI判定サンプル（先頭10件）===')
  for (const row of (data ?? []).slice(0, 10)) {
    const ok = await isRecruitmentPost(row.title, row.snippet, row.source_id)
    console.log(`${ok ? 'YES' : 'NO '} [${row.source_id}] ${row.title?.slice(0, 70)}`)
  }
} else {
  console.log('\nANTHROPIC_API_KEY 未設定 — AIサンプル判定をスキップ')
}
