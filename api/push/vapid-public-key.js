import { getUserFromBearer, getSupabaseAdmin } from '../lib/supabaseAdmin.mjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!publicKey) {
    return res.status(503).json({ error: 'VAPID_PUBLIC_KEY is not configured' })
  }

  return res.status(200).json({ publicKey })
}
