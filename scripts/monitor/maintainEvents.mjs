#!/usr/bin/env node
/**
 * 既存 events の保守（P1: データ品質）
 *
 * 1. prefecture backfill — resolveVenueAndPrefecture + resolveTokaiArea で全件再判定
 * 2. ミュージアムショップ等の低品質 events 検出（LOW_QUALITY_PATTERNS penalty>=90）
 *
 * デフォルトは dry-run（DB 変更なし・レポートのみ）。
 *
 * Usage:
 *   node scripts/monitor/maintainEvents.mjs                 # dry-run（確認）
 *   node scripts/monitor/maintainEvents.mjs --apply         # backfill のみ適用
 *   node scripts/monitor/maintainEvents.mjs --apply --close-junk   # + 低品質を closed に
 *   node scripts/monitor/maintainEvents.mjs --apply --delete-junk  # + 低品質を物理削除
 */

import { getAdminSupabase } from './lib.mjs'
import { resolveVenueAndPrefecture } from './prefectureMap.mjs'
import { resolveTokaiArea } from './tokaiRegion.mjs'

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const CLOSE_JUNK = args.has('--close-junk')
const DELETE_JUNK = args.has('--delete-junk')

const JUNK_PATTERNS = [
  /出演者募集|歌手募集|ダンサー募集|ボランティア募集|スタッフ募集|アルバイト募集|求人募集/,
  /ミュージアムショップ|委託販売|棚貸し|テナント募集|店舗出店|常設ショップ|物販コーナー/,
  /お譲り|譲ります|買い取って|リプ(?:ライ)?(?:ください|お願い)/,
]

function isJunkEvent(e) {
  const text = `${e.title ?? ''}\n${e.description ?? ''}\n${e.category ?? ''}`
  return JUNK_PATTERNS.some((re) => re.test(text))
}

function resolveEventPrefecture(e) {
  const resolved = resolveVenueAndPrefecture({
    title: e.title,
    location: e.location,
    snippet: e.description ?? '',
  })
  let prefecture = resolved.prefecture || e.prefecture || ''
  const tokai = resolveTokaiArea(e.title ?? '', e.location ?? '', e.description ?? '', e.source_id ?? '')
  if (tokai) prefecture = tokai.prefecture
  return prefecture
}

async function main() {
  const supabase = getAdminSupabase()

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, location, area, prefecture, description, category, source_id, status')

  if (error) throw error
  if (!events?.length) {
    console.log('events: 0 件。何もすることがありません。')
    return
  }

  console.log(`events: ${events.length} 件を点検\n`)

  // --- 1. prefecture backfill ---
  const prefChanges = []
  for (const e of events) {
    const next = resolveEventPrefecture(e)
    if (next && next !== (e.prefecture ?? '')) {
      prefChanges.push({ id: e.id, title: e.title, from: e.prefecture || '(空)', to: next })
    }
  }

  console.log(`== prefecture backfill: ${prefChanges.length} 件 ==`)
  for (const c of prefChanges) {
    console.log(`  ${c.from} → ${c.to}  | ${(c.title ?? '').slice(0, 40)}`)
  }

  // --- 2. 低品質（ミュージアムショップ等） ---
  const junk = events.filter(isJunkEvent)
  console.log(`\n== 低品質 events（ミュージアムショップ等）: ${junk.length} 件 ==`)
  for (const e of junk) {
    console.log(`  [${e.status}] ${(e.title ?? '').slice(0, 50)}`)
  }

  if (!APPLY) {
    console.log('\n--- dry-run（変更なし）---')
    console.log('適用: --apply / 低品質を閉じる: --close-junk / 削除: --delete-junk')
    return
  }

  // --- 適用 ---
  let prefApplied = 0
  for (const c of prefChanges) {
    const { error: updErr } = await supabase
      .from('events')
      .update({ prefecture: c.to, area: c.to, updated_at: new Date().toISOString() })
      .eq('id', c.id)
    if (updErr) {
      console.warn(`  prefecture 更新失敗 (${c.id}): ${updErr.message}`)
      continue
    }
    prefApplied++
  }
  console.log(`\nprefecture 更新: ${prefApplied}/${prefChanges.length} 件`)

  if (junk.length > 0 && (CLOSE_JUNK || DELETE_JUNK)) {
    const ids = junk.map((e) => e.id)
    if (DELETE_JUNK) {
      const { error: delErr } = await supabase.from('events').delete().in('id', ids)
      if (delErr) console.warn(`低品質 削除失敗: ${delErr.message}`)
      else console.log(`低品質 events 削除: ${ids.length} 件`)
    } else {
      const { error: closeErr } = await supabase
        .from('events')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .in('id', ids)
      if (closeErr) console.warn(`低品質 クローズ失敗: ${closeErr.message}`)
      else console.log(`低品質 events を closed に: ${ids.length} 件`)
    }
  } else if (junk.length > 0) {
    console.log('低品質 events は未処理（--close-junk / --delete-junk 未指定）')
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
