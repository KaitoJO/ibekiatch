import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ApplicationRecord,
  CalendarEvent,
  CommunityPost,
  CommunityPostForm,
  CommunityReview,
  CommunityReviewForm,
  MonitorHit,
  NotificationRecord,
  Profile,
  ProfileForm,
  Recruitment,
} from '../types'

type RecruitmentRow = {
  id: string
  title: string
  venue: string
  area: string
  genre: string
  event_date: string
  time_slot: string
  fee: number
  max_applicants: number
  is_urgent: boolean
  image_gradient: string
  description: string | null
  source_url: string | null
  created_at: string
  applications?: { count: number }[]
}

type ProfileRow = {
  id: string
  user_id: string
  display_name: string | null
  business_name: string | null
  genre: string | null
  area: string | null
  subscription_plan?: string | null
  x_auto_post?: boolean | null
}

function isTodayInJst(iso: string): boolean {
  const d = new Date(iso)
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  return (
    jst.getFullYear() === now.getFullYear() &&
    jst.getMonth() === now.getMonth() &&
    jst.getDate() === now.getDate()
  )
}

function recruitmentFromRow(row: RecruitmentRow): Recruitment {
  return {
    id: row.id,
    title: row.title,
    venue: row.venue,
    area: row.area,
    genre: row.genre,
    date: row.event_date,
    timeSlot: row.time_slot,
    fee: row.fee,
    applicants: row.applications?.[0]?.count ?? 0,
    maxApplicants: row.max_applicants,
    isNew: isTodayInJst(row.created_at),
    isUrgent: row.is_urgent,
    imageGradient: row.image_gradient,
    description: row.description ?? '',
    sourceUrl: row.source_url ?? null,
  }
}

function profileFromRow(row: ProfileRow): Profile {
  const plan = row.subscription_plan
  return {
    id: row.id,
    displayName: row.display_name ?? '',
    businessName: row.business_name ?? '',
    genre: row.genre ?? '',
    area: row.area ?? '',
    subscriptionPlan:
      plan === 'standard' || plan === 'premium' ? plan : 'free',
    xAutoPost: Boolean(row.x_auto_post),
  }
}

export type WorkspaceData = {
  recruitments: Recruitment[]
  applications: ApplicationRecord[]
  profile: Profile | null
  notifications: NotificationRecord[]
  communityPosts: CommunityPost[]
  communityReviews: CommunityReview[]
  monitorHits: MonitorHit[]
}

export async function fetchWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceData> {
  const [recruitmentsRes, applicationsRes, profileRes, notificationsRes, postsRes, reviewsRes, monitorHitsRes] =
    await Promise.all([
      supabase
        .from('recruitments')
        .select('*, applications(count)')
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('applications')
        .select('id, recruitment_id, status, created_at, confirmed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('community_reviews')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('monitor_hits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

  if (recruitmentsRes.error) throw recruitmentsRes.error
  if (applicationsRes.error) throw applicationsRes.error
  if (profileRes.error) throw profileRes.error

  const reviews = (reviewsRes.error ? [] : (reviewsRes.data ?? [])).map((r) => ({
    id: r.id,
    postId: r.post_id,
    userId: r.user_id,
    authorName: r.author_name ?? '',
    rating: r.rating,
    body: r.body ?? '',
    createdAt: r.created_at,
  }))

  const posts = (postsRes.error ? [] : (postsRes.data ?? [])).map((p) => {
    const postReviews = reviews.filter((r) => r.postId === p.id)
    const avgRating =
      postReviews.length > 0
        ? postReviews.reduce((sum, r) => sum + r.rating, 0) / postReviews.length
        : 0
    return {
      id: p.id,
      userId: p.user_id,
      authorName: p.author_name ?? '',
      title: p.title,
      body: p.body,
      area: p.area ?? '',
      genre: p.genre ?? '',
      createdAt: p.created_at,
      reviewCount: postReviews.length,
      avgRating,
    }
  })

  return {
    recruitments: (recruitmentsRes.data ?? []).map((row) =>
      recruitmentFromRow(row as RecruitmentRow),
    ),
    applications: (applicationsRes.data ?? []).map((row) => ({
      id: row.id,
      recruitmentId: row.recruitment_id,
      status: row.status as ApplicationRecord['status'],
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at ?? null,
    })),
    profile: profileRes.data ? profileFromRow(profileRes.data as ProfileRow) : null,
    notifications: (notificationsRes.error ? [] : (notificationsRes.data ?? [])).map((n) => ({
      id: n.id,
      type: n.type as NotificationRecord['type'],
      title: n.title,
      body: n.body ?? '',
      relatedId: n.related_id,
      actionUrl: n.action_url ?? null,
      isRead: n.is_read,
      createdAt: n.created_at,
    })),
    communityPosts: posts,
    communityReviews: reviews,
    monitorHits: (monitorHitsRes.error ? [] : (monitorHitsRes.data ?? [])).map((h) => ({
      id: h.id,
      sourceId: h.source_id,
      title: h.title,
      url: h.url,
      snippet: h.snippet ?? '',
      matchedKeywords: h.matched_keywords ?? [],
      publishedAt: h.published_at,
      createdAt: h.created_at,
    })),
  }
}

export function buildCalendarEvents(
  applications: ApplicationRecord[],
  recruitments: Recruitment[],
): CalendarEvent[] {
  const recruitmentMap = new Map(recruitments.map((r) => [r.id, r]))
  return applications
    .filter((app) => app.status === 'accepted')
    .map((app) => {
      const r = recruitmentMap.get(app.recruitmentId)
      if (!r) return null
      return {
        id: app.id,
        recruitmentId: r.id,
        title: r.title,
        venue: r.venue,
        area: r.area,
        date: r.date,
        timeSlot: r.timeSlot,
        status: app.status,
        fee: r.fee,
      }
    })
    .filter((e): e is CalendarEvent => e != null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  form: ProfileForm,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        display_name: form.displayName.trim(),
        business_name: form.businessName.trim(),
        genre: form.genre.trim(),
        area: form.area.trim(),
        x_auto_post: form.xAutoPost ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()

  if (error) throw error
  return profileFromRow(data as ProfileRow)
}

export async function insertApplication(
  supabase: SupabaseClient,
  userId: string,
  recruitmentId: string,
): Promise<void> {
  const { error } = await supabase.from('applications').insert({
    user_id: userId,
    recruitment_id: recruitmentId,
    status: 'pending',
  })
  if (error) throw error
}

export async function confirmShopApplication(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .update({
      status: 'accepted',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .eq('user_id', userId)
    .eq('status', 'pending')
  if (error) throw error
}

export async function markNotificationRead(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

export async function insertCommunityPost(
  supabase: SupabaseClient,
  userId: string,
  authorName: string,
  form: CommunityPostForm,
): Promise<void> {
  const { error } = await supabase.from('community_posts').insert({
    user_id: userId,
    author_name: authorName,
    title: form.title.trim(),
    body: form.body.trim(),
    area: form.area.trim(),
    genre: form.genre.trim(),
  })
  if (error) throw error
}

export async function insertCommunityReview(
  supabase: SupabaseClient,
  userId: string,
  authorName: string,
  postId: string,
  form: CommunityReviewForm,
): Promise<void> {
  const { error } = await supabase.from('community_reviews').insert({
    post_id: postId,
    user_id: userId,
    author_name: authorName,
    rating: form.rating,
    body: form.body.trim(),
  })
  if (error) throw error
}

export async function insertCommunityNotification(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  relatedId?: string,
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type: 'community',
    title,
    body,
    related_id: relatedId ?? null,
  })
  if (error) throw error
}

export type { Profile, ProfileForm }
