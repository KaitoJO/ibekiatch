import {
  Bell,
  CalendarDays,
  Home,
  MessageCircle,
  User,
} from 'lucide-react'
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
  { id: 'community', label: 'コミュニティ', icon: MessageCircle },
  { id: 'profile', label: 'マイページ', icon: User },
]

type Props = {
  active: TabId
  onChange: (tab: TabId) => void
  notificationBadge?: number
}

export function TabBar({ active, onChange, notificationBadge = 0 }: Props) {
  return (
    <nav className="tab-bar" aria-label="メインナビゲーション">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id
        const badge = id === 'notifications' ? notificationBadge : 0
        return (
          <button
            key={id}
            type="button"
            className={`tab-bar__item${isActive ? ' tab-bar__item--active' : ''}`}
            onClick={() => onChange(id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={label}
          >
            <Icon className="tab-bar__icon" strokeWidth={isActive ? 2.5 : 2} />
            <span className="tab-bar__label">{label}</span>
            {badge > 0 && (
              <span className="tab-bar__badge" aria-hidden>
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
