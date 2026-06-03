/**
 * 別タブ（閲覧履歴など）からホームのイベント詳細を開くための受け渡し。
 * ホーム画面はアクティブ時のみマウントされるため、ID を一旦保持し
 * HomeScreen がマウント時に取り出して詳細を開く。
 */

let pendingEventId: string | null = null

export function requestEventDetail(eventId: string) {
  pendingEventId = eventId
}

export function consumePendingEventDetail(): string | null {
  const id = pendingEventId
  pendingEventId = null
  return id
}
