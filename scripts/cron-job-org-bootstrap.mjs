#!/usr/bin/env node
/**
 * Create all ibekiatch monitor cron jobs on cron-job.org via REST API.
 * (13 source batches + events pipeline — ニュース系除外)
 *
 * Usage:
 *   CRON_JOB_ORG_API_KEY=... node scripts/cron-job-org-bootstrap.mjs
 *
 * API key: Settings → API Keys → Display Key (requires account password).
 * Docs: https://docs.cron-job.org/rest-api.html
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CRON_BATCHES } from './monitor/cronBatches.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const API = 'https://api.cron-job.org'
const TOKEN =
  process.env.MONITOR_CRON_TOKEN?.trim() ||
  extractTokenFromUrlsFile()

const JOBS = [
  ...Array.from({ length: CRON_BATCHES.length }, (_, i) => ({
    title: `ibekiatch batch ${i}`,
    url: `https://ibekiatch.vercel.app/api/cron/monitor?batch=${i}`,
    minute: i * 2,
  })),
  {
    title: 'ibekiatch events pipeline',
    url: 'https://ibekiatch.vercel.app/api/cron/monitor?pipeline=events',
    minute: 28,
  },
]

function extractTokenFromUrlsFile() {
  try {
    const text = readFileSync(resolve(root, 'docs/cron-job-urls.local.txt'), 'utf8')
    const m = text.match(/token=([a-f0-9]{64})/)
    return m?.[1] ?? ''
  } catch {
    return ''
  }
}

function buildJob({ title, url, minute }) {
  return {
    title,
    url,
    enabled: true,
    saveResponses: false,
    requestMethod: 0,
    requestTimeout: 30,
    extendedData: {
      headers: {
        'x-monitor-token': TOKEN,
      },
    },
    schedule: {
      timezone: 'UTC',
      expiresAt: 0,
      hours: [-1],
      mdays: [-1],
      months: [-1],
      wdays: [-1],
      minutes: [minute],
    },
  }
}

async function api(method, path, body) {
  const key = process.env.CRON_JOB_ORG_API_KEY?.trim()
  if (!key) {
    throw new Error('Set CRON_JOB_ORG_API_KEY (Settings → API Keys → Display Key)')
  }
  if (!TOKEN) {
    throw new Error('MONITOR_CRON_TOKEN missing (env or docs/cron-job-urls.local.txt)')
  }

  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
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

  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`)
  }
  return json
}

async function listJobs() {
  const data = await api('GET', '/jobs')
  return data.jobs ?? []
}

async function createJob(spec) {
  const data = await api('PUT', '/jobs', { job: buildJob(spec) })
  return data.jobId
}

async function main() {
  const existing = await listJobs()
  const ibekiatch = existing.filter((j) => j.title?.startsWith('ibekiatch'))
  console.log(`Existing ibekiatch jobs: ${ibekiatch.length}`)

  const created = []
  for (const spec of JOBS) {
    if (ibekiatch.some((j) => j.title === spec.title)) {
      console.log(`skip (exists): ${spec.title}`)
      continue
    }
    const jobId = await createJob(spec)
    created.push({ ...spec, jobId })
    console.log(`created: ${spec.title} → ${jobId}`)
    // PUT /jobs: max 5/min — wait 13s between creates
    await new Promise((r) => setTimeout(r, 13_000))
  }

  const final = await listJobs()
  const ours = final.filter((j) => j.title?.startsWith('ibekiatch'))
  console.log(`\nTotal ibekiatch jobs: ${ours.length}`)
  for (const j of ours.sort((a, b) => a.title.localeCompare(b.title))) {
    console.log(`  ${j.title} | ${j.url} | enabled=${j.enabled}`)
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
