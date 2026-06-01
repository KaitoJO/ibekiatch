import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { buildCalendarEvents, fetchWorkspace, insertApplication, insertCommunityNotification, insertCommunityPost, insertCommunityReview, markAllNotificationsRead, markNotificationRead, upsertProfile, type ProfileForm } from '../lib/workspaceDb'
import { getSupabase } from '../lib/supabaseClient'
import { formatError } from '../lib/formatError'
import type { ApplicationRecord, CalendarEvent, CommunityPost, CommunityPostForm, CommunityReview, CommunityReviewForm, NotificationRecord, Profile, Recruitment } from '../types'

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
  calendarEvents: CalendarEvent[]
  appliedRecruitmentIds: Set<string>
  unreadNotificationCount: number
  authorName: string
  refreshWorkspace: () => Promise<void>
  applyToRecruitment: (recruitmentId: string) => Promise<void>
  saveProfile: (form: ProfileForm) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  createCommunityPost: (form: CommunityPostForm) => Promise<void>
  createCommunityReview: (postId: string, form: CommunityReviewForm) => Promise<void>
  signOut: () => Promise<void>
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

  const clearWorkspace = useCallback(() => {
    setRecruitments([])
    setApplications([])
    setProfile(null)
    setNotifications([])
    setCommunityPosts([])
    setCommunityReviews([])
    setWorkspaceError(null)
    setWorkspaceLoading(false)
  }, [])

  const refreshWorkspace = useCallback(async () => {
    if (!supabase || !session?.user?.id) return
    setWorkspaceLoading(true)
    setWorkspaceError(null)
    try {
      const data = await fetchWorkspace(supabase, session.user.id)
      setRecruitments(data.recruitments)
      setApplications(data.applications)
      setProfile(data.profile)
      setNotifications(data.notifications)
      setCommunityPosts(data.communityPosts)
      setCommunityReviews(data.communityReviews)
    } catch (err) {
      setWorkspaceError(formatError(err))
    } finally {
      setWorkspaceLoading(false)
    }
  }, [supabase, session?.user?.id])

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      setAuthReady(true)
      return
    }
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      if (!cancelled) {
        setSession(sess)
        setAuthReady(true)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      if (!sess) clearWorkspace()
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase, clearWorkspace])

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
        '投稿を公開しました',
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

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [supabase])

  const appliedRecruitmentIds = useMemo(
    () => new Set(applications.map((a) => a.recruitmentId)),
    [applications],
  )

  const calendarEvents = useMemo(
    () => buildCalendarEvents(applications, recruitments),
    [applications, recruitments],
  )

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  )

  const value: AuthContextValue = {
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
    calendarEvents,
    appliedRecruitmentIds,
    unreadNotificationCount,
    authorName,
    refreshWorkspace,
    applyToRecruitment,
    saveProfile,
    markNotificationRead: handleMarkNotificationRead,
    markAllNotificationsRead: handleMarkAllNotificationsRead,
    createCommunityPost,
    createCommunityReview,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
