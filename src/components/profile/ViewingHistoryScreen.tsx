import { ChevronRight, Clock } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { formatDateTime } from '../../lib/recruitmentUtils'
import { requestEventDetail } from '../../lib/eventDetailNavigation'
import { navigateTab } from '../../lib/tabNavigation'
import { ScreenHeader } from '../shared/ScreenHeader'
import '../shared/shared.css'
import './profile.css'

type Props = {
  onBack: () => void
}

export function ViewingHistoryScreen({ onBack }: Props) {
  const { viewingHistory } = useAuth()

  const openEvent = (eventId: string) => {
    requestEventDetail(eventId)
    navigateTab('home')
  }

  return (
    <div className="profile-screen screen">
      <ScreenHeader title="閲覧履歴" onBack={onBack} gradient />

      <div className="profile-body">
        <section className="profile-card">
          {viewingHistory.length === 0 ? (
            <div className="profile-history-empty">
              <Clock size={32} strokeWidth={1.5} aria-hidden />
              <p>まだ閲覧履歴がありません。</p>
              <p className="profile-history-empty__hint">イベント詳細を開くとここに記録されます。</p>
            </div>
          ) : (
            <ul className="profile-history-list">
              {viewingHistory.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="profile-history-item profile-history-item--link"
                    onClick={() => openEvent(item.eventId)}
                  >
                    <div className="profile-history-item__main">
                      <div className="profile-history-item__title">{item.eventTitle}</div>
                      <div className="profile-history-item__time">{formatDateTime(item.viewedAt)}</div>
                    </div>
                    <ChevronRight size={18} className="profile-history-item__chevron" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
