import { getUserFromBearer, getSupabaseAdmin } from '../lib/supabaseAdmin.mjs'

function parseBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const user = await getUserFromBearer(req)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = parseBody(req)
    const endpoint = body.endpoint?.trim()
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint required' })
    }

    const admin = getSupabaseAdmin()
    const { error } = await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal error',
    })
  }
}
