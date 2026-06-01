import { useState } from 'react'
import { AuthScreen } from './components/auth/AuthScreen'
import { LoadingScreen, SetupScreen, isSupabaseConfigured } from './components/auth/SetupScreen'
import { CalendarScreen } from './components/calendar/CalendarScreen'
import { CommunityScreen } from './components/community/CommunityScreen'
import { HomeScreen } from './components/home/HomeScreen'
import { TabBar } from './components/layout/TabBar'
import { NotificationsScreen } from './components/notifications/NotificationsScreen'
import { ProfileScreen } from './components/profile/ProfileScreen'
import { AuthProvider, useAuth } from './hooks/useAuth'
import type { TabId } from './types'

function AppContent() {
  const { supabase, session, authReady, unreadNotificationCount } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('home')

  if (!authReady) {
    return <LoadingScreen />
  }

  if (!session) {
    return supabase ? <AuthScreen supabase={supabase} /> : null
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen onNavigateTab={setActiveTab} />
      case 'calendar':
        return <CalendarScreen />
      case 'notifications':
        return <NotificationsScreen />
      case 'community':
        return <CommunityScreen />
      case 'profile':
        return <ProfileScreen />
      default:
        return <HomeScreen onNavigateTab={setActiveTab} />
    }
  }

  return (
    <div className="app-shell">
      <main className="app-main">{renderScreen()}</main>
      <TabBar
        active={activeTab}
        onChange={setActiveTab}
        notificationBadge={unreadNotificationCount}
      />
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
