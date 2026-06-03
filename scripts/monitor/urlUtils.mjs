const JUNK_TITLE_RE =
  /^(threads(\s+threads)+|click here|here|more|sign up|log in|login)$/i

const BLOCKED_URL_RE = [
  /google\.com\/search/i,
  /bing\.com\/search/i,
  /duckduckgo\.com\/html/i,
  /\/search\?q=/i,
  /^\/url\?/i,
  /threads\.(net|com)/i,
]

// Haiku 3.5 (claude-3-5-haiku-*) は API 退役済み → Haiku 4.5 を使用
const CLAUDE_RECRUITMENT_MODEL = 'claude-haiku-4-5'
const AI_CONCURRENCY = 2
const AI_CONTENT_MAX = 1500
const AI_MIN_GAP_MS = 1300
const AI_MAX_RETRIES = 4

let aiActive = 0
const aiWaiters = []
let aiLastCallAt = 0

async function acquireAiSlot() {
  while (aiActive >= AI_CONCURRENCY) {
    await new Promise((resolve) => aiWaiters.push(resolve))
  }
  aiActive++
  const since = Date.now() - aiLastCallAt
  if (since < AI_MIN_GAP_MS) {
    await new Promise((r) => setTimeout(r, AI_MIN_GAP_MS - since))
  }
}

function releaseAiSlot() {
  aiActive--
  aiLastCallAt = Date.now()
  const next = aiWaiters.shift()
  if (next) next()
}

async function callAnthropicMessages(apiKey, body) {
  let delayMs = 2000
  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    await acquireAiSlot()
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })

      if (res.status === 429 && attempt < AI_MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('retry-after'))
        await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) ? retryAfter * 1000 : delayMs))
        delayMs = Math.min(delayMs * 2, 30000)
        continue
      }

      return res
    } finally {
      releaseAiSlot()
    }
  }
  return null
}

function buildRecruitmentPrompt(title, content, source) {
  return `あなたはキッチンカー・露天・マルシェの出店募集情報を判定するAIです。
以下の投稿を分析して、「主催者・会場側が出店者を募集している投稿」かどうかを判定してください。
【除外すべき投稿】
- 出店者本人が「出店します」「出店しました」と宣伝している投稿
- 出店の感想・レポート投稿
- キッチンカーを見た・食べたという一般人の投稿
- 関係のないニュース・商品紹介
- すでに募集終了・受付終了・締切済み・満員・定員到達・開催中止のもの
- ミュージアムショップ・委託販売・棚貸し・テナント募集・店舗出店の募集
【含めるべき投稿（YES と判定するのはこれのみ）】
- キッチンカー・露天・マルシェ・フードトラック・移動販売の出店募集
- 「出店者募集」「キッチンカー募集」で現在募集中のもの
- マルシェ・イベントの出店申込受付
- 会場・主催者からの出店者向け案内
ソース: ${source}
タイトル: ${title}
本文: ${content}
「現在募集中の募集投稿である」場合のみ YES、それ以外（募集終了含む）は NO を返してください。YESまたはNOのみ回答。`
}

function getAnthropicApiKey() {
  return (process.env.ANTHROPIC_API_KEY ?? '').trim()
}

export { getAnthropicApiKey, callAnthropicMessages }

function stripInvalidSurrogates(text) {
  return (text ?? '').replace(/[\uD800-\uDFFF]/g, '')
}

function normalizeText(text) {
  return stripInvalidSurrogates(text).replace(/\s+/g, ' ').trim()
}

export { normalizeText, stripInvalidSurrogates }

function parseYesNo(text) {
  const answer = (text ?? '').trim().toUpperCase()
  if (answer.startsWith('YES')) return true
  if (answer.startsWith('NO')) return false
  return answer.includes('YES')
}

/**
 * Claude API で主催者募集投稿か判定する（キーワード感知後の第2段階）
 * API エラー時は true（取りこぼし防止）
 */
export async function isRecruitmentPost(title, content, source) {
  const apiKey = getAnthropicApiKey()
  if (!apiKey) {
    console.warn('[isRecruitmentPost] ANTHROPIC_API_KEY 未設定 — 通過扱い')
    return true
  }

  const safeTitle = normalizeText(title).slice(0, 500)
  const safeContent = normalizeText(content).slice(0, AI_CONTENT_MAX)
  const prompt = buildRecruitmentPrompt(safeTitle, safeContent, source ?? '')

  try {
    const res = await callAnthropicMessages(apiKey, {
      model: CLAUDE_RECRUITMENT_MODEL,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    })

    if (!res) {
      console.warn('[isRecruitmentPost] レート制限 — 通過扱い')
      return true
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.warn(`[isRecruitmentPost] API ${res.status}:`, errBody.slice(0, 200))
      return true
    }

    const data = await res.json()
    const text = data?.content?.find((block) => block.type === 'text')?.text ?? ''
    return parseYesNo(text)
  } catch (err) {
    console.warn(
      '[isRecruitmentPost] エラー — 通過扱い:',
      err instanceof Error ? err.message : err,
    )
    return true
  }
}

/** 複数候補を並列（上限付き）で AI 判定 */
export async function filterRecruitmentPosts(items, sourceId, { concurrency = AI_CONCURRENCY } = {}) {
  if (items.length === 0) return []

  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      const item = items[index]
      const ok = await isRecruitmentPost(item.title, item.snippet, sourceId)
      results[index] = ok ? item : null
    }
  }

  const workers = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results.filter(Boolean)
}

export function normalizeExternalUrl(raw, base = 'https://www.google.com') {
  if (!raw || typeof raw !== 'string') return null
  let url = raw.trim()
  if (!url) return null

  if (url.startsWith('/url?q=') || url.startsWith('/url?')) {
    try {
      url = new URL(url, base).searchParams.get('q') ?? url
    } catch {
      return null
    }
  }

  if (!/^https?:\/\//i.test(url)) return null

  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('threads.net') || parsed.hostname.includes('threads.com')) {
      return null
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function isAcceptableMonitorUrl(url) {
  const normalized = normalizeExternalUrl(url)
  if (!normalized) return false
  if (BLOCKED_URL_RE.some((re) => re.test(normalized))) return false
  return true
}

export function isAcceptableMonitorTitle(title) {
  const t = (title ?? '').replace(/\s+/g, ' ').trim()
  if (t.length < 8) return false
  if (JUNK_TITLE_RE.test(t)) return false
  return true
}

export function cleanSocialText(text, platform) {
  let body = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!body) return ''

  const platformNames = [platform, 'Threads', 'Instagram', 'Facebook', 'X', 'Twitter']
  for (const name of platformNames) {
    body = body.replace(new RegExp(`^${name}\\s+`, 'i'), '')
  }
  body = body.replace(/\s+(Log in|Sign up|ログイン|サインイン).*$/i, '').trim()

  if (/^threads(\s+threads)+$/i.test(body)) return ''
  return body
}

export function sanitizeMonitorItem(item) {
  const url = normalizeExternalUrl(item.url)
  const title = (item.title ?? '').replace(/\s+/g, ' ').trim()
  const snippet = (item.snippet ?? title).replace(/\s+/g, ' ').trim()

  if (!url || !isAcceptableMonitorUrl(url)) return null
  if (!isAcceptableMonitorTitle(title)) return null

  return {
    ...item,
    url,
    title: title.slice(0, 500),
    snippet: snippet.slice(0, 1000),
    externalId: item.externalId ?? null,
  }
}
