#!/usr/bin/env node
/**
 * Web Push 用 VAPID キーペアを生成
 *
 *   npm run push:vapid-setup
 *
 * → .env と Vercel 環境変数に VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY を設定
 */
import webpush from 'web-push'

const keys = webpush.generateVAPIDKeys()

console.log('# .env / Vercel に追加:')
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('VAPID_SUBJECT=mailto:your-email@example.com')
