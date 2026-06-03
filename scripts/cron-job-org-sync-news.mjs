#!/usr/bin/env node
/**
 * cron-job.org のニュース系ジョブを無効化し、バッチ番号を新構成に同期します。
 *
 * - 無効化: ibekiatch batch 1 (google_news), batch 11 (mie_news + mie_fm)
 * - 更新: batch 2〜10, 12〜14 → 新 batch 1〜9, 11〜12
 *
 * Usage:
 *   CRON_JOB_ORG_API_KEY=... node scripts/cron-job-org-sync-news.mjs
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CRON_BATCHES } from './monitor/cronBatches.mjs'
import { parseEnvFile } from './monitor/lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const API = 'https://api.cron-job.org'
const BASE_URL = 'https://ibekiatch.vercel.app/api/cron/monitor'

const TOKEN =
  process.env.MONITOR_CRON_TOKEN?.trim() ||
  (() => {
    try {
      const text = readFileSync(resolve(root, 'docs/cron-job-urls.local.txt'), 'utf8')
      return text.match(/token=([a-f0-9]{64})/)?.[1] ?? ''
    } catch {
      return ''
    }
  })()

/** 旧 batch index → 新 batch index（null = 無効化） */
const BATCH_REMAP = {
  0: 0,
  1: null,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  11: null,
  12: 10,
  13: 11,
  14: 12,
}

function buildJobUrl(batchIndex) {
  return `${BASE_URL}?batch=${batchIndex}`
}

const fileEnv = parseEnvFile(resolve(root, '.env'))
const mergedEnv = { ...process.env, ...fileEnv }

async function api(method, path, body) {
  const key = mergedEnv.CRON_JOB_ORG_API_KEY?.trim()
  if (!key) throw new Error('CRON_JOB_ORG_API_KEY が必要です（.env に設定）')
  const token = mergedEnv.MONITOR_CRON_TOKEN?.trim() || TOKEN
  if (!token) throw new Error('MONITOR_CRON_TOKEN が必要です')

  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(body ? {} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function patchJob(jobId, patch) {
  const data = await api('GET', `/jobs/${jobId}`)
  const job = data.job ?? data
  await api('PATCH', `/jobs/${jobId}`, {
    job: {
      ...job,
      ...patch,
    },
  })
}

async function main() {
  console.log(`New batch count: ${CRON_BATCHES.length} (+ events pipeline)`)

  const { jobs } = await api('GET', '/jobs')
  const ibekiatch = (jobs ?? []).filter((j) => j.title?.startsWith('ibekiatch batch'))

  for (const job of ibekiatch.sort((a, b) => a.title.localeCompare(b.title))) {
    const m = job.title.match(/^ibekiatch batch (\d+)$/)
    if (!m) continue
    const oldIndex = Number.parseInt(m[1], 10)
    const newIndex = BATCH_REMAP[oldIndex]

    if (newIndex === null) {
      await patchJob(job.jobId, { enabled: false, title: `${job.title} (disabled news)` })
      console.log(`disabled: ${job.title}`)
      await new Promise((r) => setTimeout(r, 1500))
      continue
    }

    const sources = CRON_BATCHES[newIndex]?.join(' + ') ?? '?'
    const url = buildJobUrl(newIndex)
    await patchJob(job.jobId, {
      enabled: true,
      title: `ibekiatch batch ${newIndex}`,
      url,
    })
    console.log(`updated: batch ${oldIndex} → ${newIndex} (${sources})`)
    await new Promise((r) => setTimeout(r, 1500))
  }

  const pipeline = (jobs ?? []).find((j) => j.title?.startsWith('ibekiatch events pipeline'))
  if (pipeline) {
    console.log(`pipeline: enabled=${pipeline.enabled} (unchanged)`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
