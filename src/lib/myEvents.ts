import type { DisplayEvent } from '../types'

export type MyEventStatus = '応募中' | '出店確定'

const PENDING_PROMPT_KEY = 'ibekiatch_apply_prompt_ref'

export function resolveMyEventRefKey(event: DisplayEvent): string {
  if (event.origin === 'host' && event.recruitmentId) {
    return `recruitment:${event.recruitmentId}`
  }
  if (event.id.startsWith('host-') && event.recruitmentId) {
    return `recruitment:${event.recruitmentId}`
  }
  return `event:${event.id}`
}

export function resolveMyEventIds(event: DisplayEvent): {
  eventId: string | null
  recruitmentId: string | null
  refKey: string
} {
  const refKey = resolveMyEventRefKey(event)
  if (refKey.startsWith('recruitment:')) {
    return {
      eventId: null,
      recruitmentId: event.recruitmentId,
      refKey,
    }
  }
  return {
    eventId: event.id,
    recruitmentId: null,
    refKey,
  }
}

export function setPendingApplyPrompt(refKey: string) {
  sessionStorage.setItem(PENDING_PROMPT_KEY, refKey)
}

export function clearPendingApplyPrompt() {
  sessionStorage.removeItem(PENDING_PROMPT_KEY)
}

export function getPendingApplyPrompt(): string | null {
  return sessionStorage.getItem(PENDING_PROMPT_KEY)
}

export function myEventStatusLabel(status: MyEventStatus): string {
  return status
}

export function calendarStatusClass(status: MyEventStatus): string {
  switch (status) {
    case '応募中':
      return 'calendar-status--applying'
    case '出店確定':
      return 'calendar-status--confirmed'
    default:
      return 'calendar-status--applying'
  }
}
