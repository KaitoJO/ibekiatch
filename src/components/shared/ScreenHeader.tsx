import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import './shared.css'

type Props = {
  title: string
  onBack?: () => void
  actionLabel?: string
  onAction?: () => void
  headerRight?: ReactNode
  gradient?: boolean
}

export function ScreenHeader({ title, onBack, actionLabel, onAction, headerRight, gradient }: Props) {
  return (
    <header className={`screen-header${gradient ? ' screen-header--gradient' : ''}`}>
      {onBack && (
        <button type="button" className="screen-header__back" onClick={onBack} aria-label="戻る">
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
      )}
      <h1 className="screen-header__title">{title}</h1>
      {headerRight}
      {actionLabel && onAction && (
        <button type="button" className="screen-header__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </header>
  )
}
