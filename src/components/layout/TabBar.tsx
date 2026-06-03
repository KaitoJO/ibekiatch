import { memo, useEffect, useRef } from 'react'
import {
  Bell,
  CalendarDays,
  Home,
  User,
} from 'lucide-react'
import { navigateTab } from '../../lib/tabNavigation'
import type { TabId } from '../../types'

type TabItem = {
  id: TabId
  label: string
  icon: typeof Home
}

const TABS: TabItem[] = [
  { id: 'home', label: 'ホーム', icon: Home },
  { id: 'calendar', label: 'カレンダー', icon: CalendarDays },
  { id: 'notifications', label: '通知', icon: Bell },
  { id: 'profile', label: 'マイページ', icon: User },
]

type Props = {
  active: TabId
  notificationBadge?: number
}

function TabBarInner({ active, notificationBadge = 0 }: Props) {
  const navRef = useRef<HTMLElement>(null)
  const lastTapRef = useRef(0)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    const onTap = (e: Event) => {
      const item = (e.target as Element).closest('[data-tab-id]') as HTMLElement | null
      if (!item) return

      const id = item.dataset.tabId as TabId | undefined
      if (!id) return

      const now = Date.now()
      if (now - lastTapRef.current < 150) return
      lastTapRef.current = now

      if (e.type === 'touchend') e.preventDefault()

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      navigateTab(id)
    }

    nav.addEventListener('touchend', onTap, { passive: false, capture: true })
    nav.addEventListener('click', onTap, { capture: true })
    return () => {
      nav.removeEventListener('touchend', onTap, { capture: true })
      nav.removeEventListener('click', onTap, { capture: true })
    }
  }, [])

  return (
    <nav ref={navRef} className="tab-bar" role="tablist" aria-label="メインナビゲーション">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id
        const badge = id === 'notifications' ? notificationBadge : 0
        return (
          <div
            key={id}
            role="tab"
            aria-selected={isActive}
            data-tab-id={id}
            className={`tab-bar__item${isActive ? ' tab-bar__item--active' : ''}`}
            aria-label={label}
          >
            <Icon className="tab-bar__icon" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
            <span className="tab-bar__label">{label}</span>
            {badge > 0 && (
              <span className="tab-bar__badge" aria-hidden>
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export const TabBar = memo(TabBarInner)
