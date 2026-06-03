import type { TabId } from '../types'

type TabHandler = (tab: TabId) => void

let handler: TabHandler | null = null

export function setTabNavigationHandler(fn: TabHandler | null) {
  handler = fn
}

export function navigateTab(tab: TabId) {
  handler?.(tab)
}
