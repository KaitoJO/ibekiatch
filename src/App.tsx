import { useCallback, useEffect, useState } from 'react'
import { AuthScreen } from './components/auth/AuthScreen'
import { LoadingScreen, SetupScreen, isSupabaseConfigured } from './components/auth/SetupScreen'
import { CalendarScreen } from './components/calendar/CalendarScreen'
import { HomeScreen } from './components/home/HomeScreen'
import { TabBar } from './components/layout/TabBar'
import { NotificationsScreen } from './components/notifications/NotificationsScreen'
import { ProfileScreen } from './components/profile/ProfileScreen'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { setTabNavigationHandler } from './lib/tabNavigation'
import type { TabId } from './types'
import './components/auth/auth.css'

function AppContent() {
  const {
    supabase,
    session,
    authReady,
    unreadNotificationCount,
    authNotice,
    clearAuthNotice,
    authDisabled,
    authInitError,
    retryTestLogin,
  } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [retryBusy, setRetryBusy] = useState(false)

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab((prev) => (prev === tab ? prev : tab))
  }, [])

  useEffect(() => {
    setTabNavigationHandler(handleTabChange)
    return () => setTabNavigationHandler(null)
  }, [handleTabChange])

  if (!authReady) {
    return <LoadingScreen />
  }

  if (!session && !authDisabled) {
    return supabase ? <AuthScreen supabase={supabase} /> : null
  }

  if (authDisabled && !session) {
    return (
      <div className="auth-screen">
        <div className="auth-screen__inner">
          <div className="auth-test-login-fail" role="alert">
            <h1 className="auth-test-login-fail__title">テストログインに失敗しました</h1>
            <p className="auth-test-login-fail__body">
              自動サインインできなかったため、ゲスト状態になっています。再試行するかページを更新してください。
            </p>
            {authInitError && <p className="auth-test-login-fail__error">{authInitError}</p>}
            <button
              type="button"
              className="primary-btn auth-test-login-fail__btn"
              disabled={retryBusy}
              onClick={() => {
                setRetryBusy(true)
                void retryTestLogin().finally(() => setRetryBusy(false))
              }}
            >
              {retryBusy ? 'ログイン中…' : '再試行'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  let screen = <HomeScreen onNavigateTab={handleTabChange} />
  if (activeTab === 'calendar') screen = <CalendarScreen />
  else if (activeTab === 'notifications') screen = <NotificationsScreen />
  else if (activeTab === 'profile') screen = <ProfileScreen />

  return (
    <div className="app-shell">
      {authDisabled && (
        <div className="auth-test-banner" role="status">
          テスト期間中 — ログイン画面を省略しています
        </div>
      )}
      {authNotice && (
        <div className="auth-verified-banner" role="status">
          {authNotice}
          <button
            type="button"
            onClick={clearAuthNotice}
            style={{ marginLeft: 8, fontWeight: 800, textDecoration: 'underline' }}
          >
            閉じる
          </button>
        </div>
      )}
      <main className="app-main">
        <div key={activeTab} className="tab-screen">
          {screen}
        </div>
      </main>
      <TabBar active={activeTab} notificationBadge={unreadNotificationCount} />
    </div>
  )
}

export default function App() {
  if (!isSupabaseConfigured()) {
    return <SetupScreen />
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
