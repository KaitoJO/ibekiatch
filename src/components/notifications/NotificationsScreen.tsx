import { useAuth } from '../../hooks/useAuth'
import { formatDateTime } from '../../lib/recruitmentUtils'
import { ScreenHeader } from '../shared/ScreenHeader'
import '../shared/shared.css'
import './notifications.css'

const TYPE_ICON: Record<string, string> = {
  application: '📝',
  recruitment: '🚚',
  community: '💬',
  system: '🔔',
}

export function NotificationsScreen() {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    workspaceLoading,
  } = useAuth()

  return (
    <div className="notifications-screen screen">
      <ScreenHeader
        title="通知"
        gradient
        actionLabel={unreadNotificationCount > 0 ? 'すべて既読' : undefined}
        onAction={unreadNotificationCount > 0 ? () => void markAllNotificationsRead() : undefined}
      />

      <div className="notifications-body">
        {workspaceLoading && notifications.length === 0 && (
          <p className="notifications-loading">読み込み中…</p>
        )}

        {notifications.length === 0 && !workspaceLoading ? (
          <div className="empty-block">
            <div className="empty-block__icon">🔔</div>
            <p className="empty-block__title">通知はありません</p>
            <p>応募やコミュニティの活動があると、ここに表示されます。</p>
          </div>
        ) : (
          <ul className="notifications-list">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notification-item${n.isRead ? '' : ' notification-item--unread'}`}
                  onClick={() => {
                    if (!n.isRead) void markNotificationRead(n.id)
                  }}
                >
                  <span className="notification-item__icon" aria-hidden>
                    {TYPE_ICON[n.type] ?? '🔔'}
                  </span>
                  <div className="notification-item__content">
                    <div className="notification-item__title">{n.title}</div>
                    <div className="notification-item__body">{n.body}</div>
                    <div className="notification-item__time">{formatDateTime(n.createdAt)}</div>
                  </div>
                  {!n.isRead && <span className="notification-item__dot" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
