import { callAnthropicMessages, getAnthropicApiKey, normalizeText, stripInvalidSurrogates } from './urlUtils.mjs'
import { supplementEventDates } from './dateExtraction.mjs'
import { applyQualityAdjustments } from './qualityScoring.mjs'
import { resolveVenueAndPrefecture } from './prefectureMap.mjs'
import { resolveTokaiArea, isTokaiRegionText, MIE_LOCAL_SOURCE_IDS, getPublishConfidenceMin } from './tokaiRegion.mjs'

const STRUCTURE_MODEL = 'claude-haiku-4-5'
const AI_CONTENT_MAX = 2000

function buildStructurePrompt(title, content, source, sourceUrl, { detailed = false } = {}) {
  const detailHint = detailed
    ? '\n【再分析】前回 confidence が不足していました。日付・場所・主催者・締切を特に丁寧に読み取ってください。'
    : ''

  return `あなたはキッチンカー・露天・マルシェの出店募集情報を分析するAIです。
以下の文章を読み、JSONのみで回答してください（説明文不要）。${detailHint}

分類候補 category:
- キッチンカー募集
- 露店募集
- ハンドメイド出店募集
- イベント告知のみ
- 募集終了
- 無関係

【除外】出店者本人の宣伝、感想、終了済み、スタッフ/出演者/求人募集
- ミュージアムショップ・委託販売・棚貸し・テナント募集・店舗出店
【対象】キッチンカー・露天・マルシェ・フードトラック・移動販売の出店募集のみ

ソース: ${source}
URL: ${sourceUrl ?? ''}
タイトル: ${title}
本文:
${content}

JSON形式:
{
  "category": "",
  "is_recruiting": true,
  "confidence": 0,
  "title": "",
  "organizer": "",
  "location": "",
  "event_date": "",
  "recruit_start": "",
  "recruit_end": "",
  "application_url": "",
  "fee": "",
  "source_url": ""
}

ルール:
- confidence は 0-100（三重ソース75+ / 東海ジモティー等80+ / その他85+が掲載候補）
- is_recruiting は主催者が出店者を募集中なら true
- location は市区町村名または会場名（不明なら空文字）
- 日付は YYYY-MM-DD または空文字
- application_url は応募フォームURL（なければ source_url）
- fee は「3000円」等の文字列、不明なら空`
}

function extractJson(text) {
  const raw = (text ?? '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1].trim() : raw
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}

function normalizeDate(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const m = trimmed.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  return null
}

function applyTokaiArea(raw, fallback = {}) {
  const title = normalizeText(raw?.title || fallback.title || '')
  const rawLocation = normalizeText(raw?.location || fallback.location || '')
  const resolved = resolveVenueAndPrefecture({
    title,
    location: rawLocation,
    snippet: fallback.snippet ?? '',
    sourceId: fallback.sourceId ?? '',
  })

  const tokai = resolveTokaiArea(
    title,
    rawLocation,
    fallback.snippet ?? '',
    fallback.sourceId ?? '',
  )

  const prefecture = resolved.prefecture || tokai?.prefecture || ''
  let location = resolved.venue || rawLocation
  if (!location && tokai?.area && tokai.area !== tokai.prefecture) {
    location = tokai.area
  }

  const inTokai =
    Boolean(tokai) ||
    Boolean(prefecture && ['三重県', '静岡県', '愛知県', '岐阜県'].includes(prefecture)) ||
    isTokaiRegionText(title, rawLocation, fallback.snippet)

  return {
    title,
    location,
    prefecture,
    area: prefecture,
    inTokai,
  }
}

export function normalizeStructuredEvent(raw, fallback = {}) {
  const category = normalizeText(raw?.category || '')
  const confidence = Math.min(100, Math.max(0, Number(raw?.confidence) || 0))
  const isRecruiting =
    Boolean(raw?.is_recruiting) && category !== '募集終了' && category !== '無関係'

  const { title, location, prefecture, area, inTokai } = applyTokaiArea(raw, fallback)

  return {
    category,
    is_recruiting: isRecruiting,
    confidence,
    title: title || fallback.title || '',
    organizer: normalizeText(raw?.organizer || ''),
    location,
    prefecture,
    area,
    in_tokai: inTokai,
    event_date: normalizeDate(raw?.event_date),
    recruit_start: normalizeDate(raw?.recruit_start),
    recruit_end: normalizeDate(raw?.recruit_end),
    application_url: raw?.application_url || fallback.application_url || fallback.source_url || null,
    fee: normalizeText(raw?.fee || ''),
    source_url: raw?.source_url || fallback.source_url || null,
  }
}

/**
 * @param {object} structured
 * @param {string} [sourceId]
 * @param {{ title?: string, snippet?: string }} [hit] — 元 monitor_hit（地名・閾値判定用）
 */
export function shouldPublishEvent(structured, sourceId = '', hit = {}) {
  const hitTitle = hit.title ?? ''
  const hitSnippet = hit.snippet ?? ''
  const minConf = getPublishConfidenceMin(sourceId, {
    hitTitle,
    hitSnippet,
  })
  const tokaiTextOk =
    isTokaiRegionText(structured.title, structured.location, hitSnippet) ||
    isTokaiRegionText(hitTitle, hitSnippet)
  const hasPlace =
    Boolean(structured.location?.trim()) || Boolean(structured.area?.trim())

  return (
    structured.in_tokai === true &&
    tokaiTextOk &&
    structured.confidence >= minConf &&
    structured.is_recruiting &&
    Boolean(structured.title?.trim()) &&
    hasPlace &&
    structured.category !== '無関係' &&
    structured.category !== 'イベント告知のみ'
  )
}

async function callStructureApi(title, content, source, sourceUrl, detailed) {
  const apiKey = getAnthropicApiKey()
  if (!apiKey) return null

  const res = await callAnthropicMessages(apiKey, {
    model: STRUCTURE_MODEL,
    max_tokens: detailed ? 800 : 600,
    messages: [
      {
        role: 'user',
        content: buildStructurePrompt(title, content, source, sourceUrl, { detailed }),
      },
    ],
  })

  if (!res?.ok) {
    console.warn('[structureEvent] API error', res?.status)
    return null
  }

  const json = await res.json()
  const text = json.content?.[0]?.text ?? ''
  return extractJson(text)
}

/**
 * 第1段 Haiku 構造化 → 50–79 は詳細プロンプトで再構造化 → 日付補完 → 品質降格
 */
export async function structureEventWithTieredAi(title, content, source, sourceUrl) {
  const safeTitle = stripInvalidSurrogates(title)
  const safeContent = stripInvalidSurrogates(content).slice(0, AI_CONTENT_MAX)
  const fallback = {
    title: safeTitle,
    source_url: sourceUrl,
    application_url: sourceUrl,
    snippet: safeContent,
    sourceId: source,
  }

  let parsed = await callStructureApi(safeTitle, safeContent, source, sourceUrl, false)
  let structured = normalizeStructuredEvent(parsed ?? {}, fallback)

  if (MIE_LOCAL_SOURCE_IDS.has(source)) {
    structured.in_tokai = true
  }

  const minConf = getPublishConfidenceMin(source, {
    hitTitle: safeTitle,
    hitSnippet: safeContent,
  })
  if (structured.confidence >= Math.max(50, minConf - 15) && structured.confidence < minConf) {
    const refined = await callStructureApi(safeTitle, safeContent, source, sourceUrl, true)
    if (refined) {
      const retryStructured = normalizeStructuredEvent(refined, fallback)
      if (MIE_LOCAL_SOURCE_IDS.has(source)) retryStructured.in_tokai = true
      if (retryStructured.confidence >= structured.confidence) {
        structured = retryStructured
      }
    }
  }

  structured = await supplementEventDates(structured, safeTitle, safeContent)
  structured = applyQualityAdjustments(structured, safeTitle, safeContent)

  return structured
}

/** @deprecated structureEventWithTieredAi を使用 */
export async function structureEventFromPost(title, content, source, sourceUrl) {
  return structureEventWithTieredAi(title, content, source, sourceUrl)
}
