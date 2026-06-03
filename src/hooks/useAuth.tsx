import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import {
  buildCalendarEvents,
  buildEventReviewSummaries,
  confirmShopApplication,
  fetchWorkspace,
  fetchMonitorHits,
  fetchCollectedEvents,
  MONITOR_HITS_TEST_LIMIT,
  EVENTS_TEST_LIMIT,
  insertApplication,
  insertCommunityNotification,
  insertCommunityPost,
  insertCommunityReview,
  insertEventChatMessage,
  insertEventReview,
  markAllNotificationsRead,
  markNotificationRead,
  upsertProfile,
  upsertMyEventApplied,
  insertViewingHistory,
  type ProfileForm,
} from '../lib/workspaceDb'
import { resolveMyEventIds } from '../lib/myEvents'
import { buildShopConfirmedPost, openXPostIntent } from '../lib/xPost'
import { hasPaidAccess } from '../lib/billing'
import { getSupabase } from '../lib/supabaseClient'
import { formatError } from '../lib/formatError'
import { getTestLoginCredentials, isAuthDisabled, canViewFullMonitorFeed } from '../lib/authConfig'
import type {
  ApplicationRecord,
  CalendarEvent,
  CommunityPost,
  CommunityPostForm,
  CommunityReview,
  CommunityReviewForm,
  EventChatMessage,
  EventReview,
  EventReviewForm,
  EventReviewSummary,
  CollectedEvent,
  MonitorHit,
  NotificationRecord,
  Profile,
  Recruitment,
  MyEventRecord,
  DisplayEvent,
  ViewingHistoryRecord,
} from '../types'

type AuthContextValue = {
  supabase: SupabaseClient | null
  session: Session | null
  authReady: boolean
  workspaceLoading: boolean
  workspaceError: string | null
  recruitments: Recruitment[]
  applications: ApplicationRecord[]
  profile: Profile | null
  notifications: NotificationRecord[]
  communityPosts: CommunityPost[]
  communityReviews: CommunityReview[]
  eventReviews: EventReview[]
  eventReviewSummaries: EventReviewSummary[]
  eventChatMessages: EventChatMessage[]
  monitorHits: MonitorHit[]
  collectedEvents: CollectedEvent[]
  myEvents: MyEventRecord[]
  viewingHistory: ViewingHistoryRecord[]
  calendarEvents: CalendarEvent[]
  appliedRecruitmentIds: Set<string>
  unreadNotificationCount: number
  authorName: string
  refreshWorkspace: () => Promise<void>
  refreshMonitorHits: () => Promise<void>
  applyToRecruitment: (recruitmentId: string) => Promise<void>
  confirmShop: (applicationId: string) => Promise<void>
  saveProfile: (form: ProfileForm) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  createCommunityPost: (form: CommunityPostForm) => Promise<void>
  createCommunityReview: (postId: string, form: CommunityReviewForm) => Promise<void>
  createEventReview: (form: EventReviewForm) => Promise<void>
  sendEventChatMessage: (recruitmentId: string, body: string) => Promise<void>
  signOut: () => Promise<void>
  recordEventView: (event: DisplayEvent) => Promise<void>
  markMyEventApplied: (event: DisplayEvent) => Promise<MyEventRecord | null>
  authNotice: string | null
  clearAuthNotice: () => void
  authDisabled: boolean
  authInitError: string | null
  retryTestLogin: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabase(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [recruitments, setRecruitments] = useState<Recruitment[]>([])
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([])
  const [communityReviews, setCommunityReviews] = useState<CommunityReview[]>([])
  const [eventReviews, setEventReviews] = useState<EventReview[]>([])
  const [eventChatMessages, setEventChatMessages] = useState<EventChatMessage[]>([])
  const [monitorHits, setMonitorHits] = useState<MonitorHit[]>([])
  const [collectedEvents, setCollectedEvents] = useState<CollectedEvent[]>([])
  const [myEvents, setMyEvents] = useState<MyEventRecord[]>([])
  const [viewingHistory, setViewingHistory] = useState<ViewingHistoryRecord[]>([])
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [authInitError, setAuthInitError] = useState<string | null>(null)

  const clearWorkspace = useCallback(() => {
    setRecruitments([])
    setApplications([])
    setProfile(null)
    setNotifications([])
    setCommunityPosts([])
    setCommunityReviews([])
    setEventReviews([])
    setEventChatMessages([])
    setMonitorHits([])
    setCollectedEvents([])
    setMyEvents([])
    setViewingHistory([])
    setWorkspaceError(null)
    setWorkspaceLoading(false)
  }, [])

  const refreshMonitorHits = useCallback(async () => {
    if (!supabase) return
    try {
      const full = canViewFullMonitorFeed(session?.user?.email)
      const hits = await fetchMonitorHits(
        supabase,
        full ? MONITOR_HITS_TEST_LIMIT : undefined,
      )
      setMonitorHits(hits)
    } catch {
      // ワークスペース読み込みとは別 — 失敗しても他機能は継続
    }
  }, [supabase, session?.user?.email])

  const refreshCollectedEvents = useCallback(async () => {
    if (!supabase) return
    try {
      const full = canViewFullMonitorFeed(session?.user?.email)
      const events = await fetchCollectedEvents(
        supabase,
        full ? EVENTS_TEST_LIMIT : undefined,
        full,
      )
      setCollectedEvents(events)
    } catch {
      // 公開読み取り — 失敗しても他機能は継続
    }
  }, [supabase, session?.user?.email])

  const refreshInFlightRef = useRef(false)
  const refreshPendingRef = useRef(false)

  const refreshWorkspace = useCallback(async () => {
    if (!supabase || !session?.user?.id) return
    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true
      return
    }
    refreshInFlightRef.current = true
    setWorkspaceLoading(true)
    setWorkspaceError(null)
    try {
      const full = canViewFullMonitorFeed(session?.user?.email)
      const data = await fetchWorkspace(supabase, session.user.id, {
        monitorHitsLimit: full ? MONITOR_HITS_TEST_LIMIT : undefined,
        eventsLimit: full ? EVENTS_TEST_LIMIT : undefined,
        includeClosedEvents: full,
      })
      setRecruitments(data.recruitments)
      setApplications(data.applications)
      setProfile(data.profile)
      setNotifications(data.notifications)
      setCommunityPosts(data.communityPosts)
      setCommunityReviews(data.communityReviews)
      setEventReviews(data.eventReviews)
      setEventChatMessages(data.eventChatMessages)
      setMonitorHits(data.monitorHits)
      setCollectedEvents(data.collectedEvents)
      setMyEvents(data.myEvents)
      setViewingHistory(data.viewingHistory)
    } catch (err) {
      setWorkspaceError(formatError(err))
    } finally {
      refreshInFlightRef.current = false
      setWorkspaceLoading(false)
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false
        void refreshWorkspace()
      }
    }
  }, [supabase, session?.user?.id, session?.user?.email])

  const authDisabled = isAuthDisabled()

  const retryTestLogin = useCallback(async () => {
    if (!supabase || !authDisabled) return
    const creds = getTestLoginCredentials()
    if (!creds) {
      setAuthInitError('VITE_TEST_LOGIN_EMAIL / VITE_TEST_LOGIN_PASSWORD が未設定です。')
      return
    }
    setAuthInitError(null)
    const { data, error } = await supabase.auth.signInWithPassword(creds)
    if (error) {
      setAuthInitError(`テスト自動ログイン失敗: ${formatError(error)}`)
      return
    }
    setSession(data.session)
  }, [supabase, authDisabled])

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      setAuthReady(true)
      return
    }
    let cancelled = false

    async function initAuth() {
      const client = supabase
      if (!client) return
      const { data: { session: existing } } = await client.auth.getSession()
      if (cancelled) return

      if (existing) {
        setSession(existing)
        setAuthReady(true)
        return
      }

      if (authDisabled) {
        const creds = getTestLoginCredentials()
        if (creds) {
          const { data, error } = await client.auth.signInWithPassword(creds)
          if (cancelled) return
          if (error) {
            const msg = `テスト自動ログイン失敗: ${formatError(error)}`
            setAuthInitError(msg)
            setWorkspaceError(msg)
          } else {
            setAuthInitError(null)
            setSession(data.session)
          }
        } else {
          const msg =
            'テストモード: VITE_TEST_LOGIN_EMAIL / VITE_TEST_LOGIN_PASSWORD を Vercel に設定してください。'
          setAuthInitError(msg)
          setWorkspaceError(msg)
        }
      }

      setAuthReady(true)
    }

    void initAuth()

    const authTimeout = window.setTimeout(() => {
      if (!cancelled) setAuthReady(true)
    }, 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'TOKEN_REFRESHED' && sess) {
        setSession(sess)
        return
      }
      if (event === 'SIGNED_OUT') {
        setSession(null)
        clearWorkspace()
        return
      }
      setSession(sess)
      if (!sess) clearWorkspace()
      if (
        event === 'SIGNED_IN' &&
        typeof window !== 'undefined' &&
        /type=(signup|email|magiclink)/.test(window.location.hash)
      ) {
        setAuthNotice('メール確認が完了しました。ようこそ！')
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    })
    return () => {
      cancelled = true
      window.clearTimeout(authTimeout)
      subscription.unsubscribe()
    }
  }, [supabase, clearWorkspace, authDisabled])

  useEffect(() => {
    if (!supabase) return
    void refreshMonitorHits()
    void refreshCollectedEvents()
    const interval = window.setInterval(() => {
      void refreshMonitorHits()
      void refreshCollectedEvents()
    }, 3 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [supabase, refreshMonitorHits, refreshCollectedEvents])

  useEffect(() => {
    if (!supabase || !session?.user?.id) return
    void refreshWorkspace()
  }, [supabase, session?.user?.id, refreshWorkspace])

  const authorName = useMemo(() => {
    if (profile?.businessName) return profile.businessName
    if (profile?.displayName) return profile.displayName
    return session?.user?.email?.split('@')[0] ?? '匿名'
  }, [profile, session?.user?.email])

  const applyToRecruitment = useCallback(
    async (recruitmentId: string) => {
      if (!supabase || !session?.user?.id) return
      await insertApplication(supabase, session.user.id, recruitmentId)
      await refreshWorkspace()
    },
    [supabase, session?.user?.id, refreshWorkspace],
  )

  const confirmShop = useCallback(
    async (applicationId: string) => {
      if (!supabase || !session?.user?.id) return
      const app = applications.find((a) => a.id === applicationId)
      const recruitment = app ? recruitments.find((r) => r.id === app.recruitmentId) : null
      await confirmShopApplication(supabase, session.user.id, applicationId)
      if (
        hasPaidAccess(profile) &&
        profile?.subscriptionPlan === 'premium' &&
        profile?.xAutoPost &&
        recruitment
      ) {
        openXPostIntent(
          buildShopConfirmedPost({
            title: recruitment.title,
            venue: recruitment.venue,
            date: recruitment.date,
            area: recruitment.area,
          }),
        )
      }
      await refreshWorkspace()
    },
    [supabase, session?.user?.id, applications, recruitments, profile, refreshWorkspace],
  )

  const saveProfile = useCallback(
    async (form: ProfileForm) => {
      if (!supabase || !session?.user?.id) return
      const next = await upsertProfile(supabase, session.user.id, form)
      setProfile(next)
    },
    [supabase, session?.user?.id],
  )

  const handleMarkNotificationRead = useCallback(
    async (id: string) => {
      if (!supabase || !session?.user?.id) return
      await markNotificationRead(supabase, session.user.id, id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      )
    },
    [supabase, session?.user?.id],
  )

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (!supabase || !session?.user?.id) return
    await markAllNotificationsRead(supabase, session.user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }, [supabase, session?.user?.id])

  const createCommunityPost = useCallback(
    async (form: CommunityPostForm) => {
      if (!supabase || !session?.user?.id) return
      await insertCommunityPost(supabase, session.user.id, authorName, form)
      await insertCommunityNotification(
        supabase,
        session.user.id,
        '出店情報をシェアしました',
        `「${form.title.trim()}」をコミュニティに投稿しました。`,
      )
      await refreshWorkspace()
    },
    [supabase, session?.user?.id, authorName, refreshWorkspace],
  )

  const createCommunityReview = useCallback(
    async (postId: string, form: CommunityReviewForm) => {
      if (!supabase || !session?.user?.id) return
      await insertCommunityReview(supabase, session.user.id, authorName, postId, form)
      const post = communityPosts.find((p) => p.id === postId)
      await insertCommunityNotification(
        supabase,
        session.user.id,
        'レビューを投稿しました',
        post ? `「${post.title}」に★${form.rating}のレビューを追加しました。` : 'レビューを追加しました。',
        postId,
      )
      await refreshWorkspace()
    },
    [supabase, session?.user?.id, authorName, communityPosts, refreshWorkspace],
  )

  const createEventReview = useCallback(
    async (form: EventReviewForm) => {
      if (!supabase || !session?.user?.id) return
      await insertEventReview(supabase, session.user.id, authorName, form)
      const recruitment = recruitments.find((r) => r.id === form.recruitmentId)
      await insertCommunityNotification(
        supabase,
        session.user.id,
        'イベント口コミを投稿しました',
        recruitment
          ? `「${recruitment.title}」の口コミを投稿しました。`
          : 'イベント口コミを投稿しました。',
        form.recruitmentId,
      )
      await refreshWorkspace()
    },
    [supabase, session?.user?.id, authorName, recruitments, refreshWorkspace],
  )

  const sendEventChatMessage = useCallback(
    async (recruitmentId: string, body: string) => {
      if (!supabase || !session?.user?.id || !body.trim()) return
      await insertEventChatMessage(supabase, session.user.id, authorName, recruitmentId, body)
      await refreshWorkspace()
    },
    [supabase, session?.user?.id, authorName, refreshWorkspace],
  )

  const signOut = useCallback(async () => {
    if (!supabase || authDisabled) return
    await supabase.auth.signOut()
  }, [supabase, authDisabled])

  const recordEventView = useCallback(
    async (event: DisplayEvent) => {
      if (!supabase || !session?.user?.id) return
      try {
        const record = await insertViewingHistory(supabase, session.user.id, {
          eventId: event.id,
          eventTitle: event.title,
        })
        setViewingHistory((prev) => [record, ...prev].slice(0, 100))
      } catch {
        // 閲覧履歴の失敗は詳細表示を妨げない
      }
    },
    [supabase, session?.user?.id],
  )

  const markMyEventApplied = useCallback(
    async (event: DisplayEvent) => {
      if (!supabase || !session?.user?.id) return null
      const { eventId, recruitmentId, refKey } = resolveMyEventIds(event)
      const record = await upsertMyEventApplied(supabase, session.user.id, {
        refKey,
        eventId,
        recruitmentId,
        eventDate: event.eventDate,
        eventTitle: event.title,
        eventLocation: event.location,
        area: event.area,
      })
      setMyEvents((prev) => {
        const rest = prev.filter((m) => m.refKey !== refKey)
        return [record, ...rest]
      })
      return record
    },
    [supabase, session?.user?.id],
  )

  const appliedRecruitmentIds = useMemo(
    () => new Set(applications.map((a) => a.recruitmentId)),
    [applications],
  )

  const calendarEvents = useMemo(
    () => buildCalendarEvents(applications, recruitments, myEvents),
    [applications, recruitments, myEvents],
  )

  const eventReviewSummaries = useMemo(
    () => buildEventReviewSummaries(eventReviews),
    [eventReviews],
  )

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  )

  const value: AuthContextValue = useMemo(
    () => ({
      supabase,
      session,
      authReady,
      workspaceLoading,
      workspaceError,
      recruitments,
      applications,
      profile,
      notifications,
      communityPosts,
      communityReviews,
      eventReviews,
      eventReviewSummaries,
      eventChatMessages,
      monitorHits,
      collectedEvents,
      myEvents,
      viewingHistory,
      calendarEvents,
      appliedRecruitmentIds,
      unreadNotificationCount,
      authorName,
      refreshWorkspace,
      refreshMonitorHits,
      applyToRecruitment,
      confirmShop,
      saveProfile,
      markNotificationRead: handleMarkNotificationRead,
      markAllNotificationsRead: handleMarkAllNotificationsRead,
      createCommunityPost,
      createCommunityReview,
      createEventReview,
      sendEventChatMessage,
      signOut,
      recordEventView,
      markMyEventApplied,
      authNotice,
      clearAuthNotice: () => setAuthNotice(null),
      authDisabled,
      authInitError,
      retryTestLogin,
    }),
    [
      supabase,
      session,
      authReady,
      workspaceLoading,
      workspaceError,
      recruitments,
      applications,
      profile,
      notifications,
      communityPosts,
      communityReviews,
      eventReviews,
      eventReviewSummaries,
      eventChatMessages,
      monitorHits,
      collectedEvents,
      myEvents,
      viewingHistory,
      calendarEvents,
      appliedRecruitmentIds,
      unreadNotificationCount,
      authorName,
      refreshWorkspace,
      refreshMonitorHits,
      applyToRecruitment,
      confirmShop,
      saveProfile,
      handleMarkNotificationRead,
      handleMarkAllNotificationsRead,
      createCommunityPost,
      createCommunityReview,
      createEventReview,
      sendEventChatMessage,
      signOut,
      recordEventView,
      markMyEventApplied,
      authNotice,
      authDisabled,
      authInitError,
      retryTestLogin,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
