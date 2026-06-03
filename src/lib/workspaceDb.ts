import type { SupabaseClient } from '@supabase/supabase-js'
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
  subscription_status?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
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

function normalizeSubscriptionStatus(value: string | null | undefined): Profile['subscriptionStatus'] {
  if (
    value === 'active' ||
    value === 'trialing' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'unpaid'
  ) {
    return value
  }
  return 'none'
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
    subscriptionStatus: normalizeSubscriptionStatus(row.subscription_status),
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
  eventReviews: EventReview[]
  eventChatMessages: EventChatMessage[]
  monitorHits: MonitorHit[]
  collectedEvents: CollectedEvent[]
}

const EVENTS_LIMIT = 100
export const EVENTS_TEST_LIMIT = 300
export const MONITOR_HITS_TEST_LIMIT = 300

type EventRow = {
  id: string
  monitor_hit_id: string | null
  recruitment_id: string | null
  source_id: string | null
  origin: 'collected' | 'host'
  title: string
  organizer: string
  location: string
  area: string
  event_date: string | null
  recruit_start: string | null
  recruit_end: string | null
  fee: string
  category: string
  application_url: string | null
  source_url: string | null
  description: string
  status: 'open' | 'closed'
  confidence: number
  created_at: string
}

function eventFromRow(row: EventRow): CollectedEvent {
  return {
    id: row.id,
    monitorHitId: row.monitor_hit_id,
    recruitmentId: row.recruitment_id,
    sourceId: row.source_id,
    origin: row.origin,
    title: row.title,
    organizer: row.organizer,
    location: row.location,
    area: row.area,
    eventDate: row.event_date,
    recruitStart: row.recruit_start,
    recruitEnd: row.recruit_end,
    fee: row.fee,
    category: row.category,
    applicationUrl: row.application_url,
    sourceUrl: row.source_url,
    description: row.description,
    status: row.status,
    confidence: row.confidence,
    createdAt: row.created_at,
  }
}

export async function fetchCollectedEvents(
  supabase: SupabaseClient,
  limit = EVENTS_LIMIT,
  includeClosed = false,
): Promise<CollectedEvent[]> {
  let query = supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!includeClosed) {
    query = query.eq('status', 'open')
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => eventFromRow(row as EventRow))
}

const MONITOR_HITS_LIMIT = 100

type MonitorHitRow = {
  id: string
  source_id: string
  title: string
  url: string | null
  snippet: string | null
  matched_keywords: string[] | null
  published_at: string | null
  created_at: string
}

function monitorHitFromRow(h: MonitorHitRow): MonitorHit {
  return {
    id: h.id,
    sourceId: h.source_id,
    title: h.title,
    url: h.url,
    snippet: h.snippet ?? '',
    matchedKeywords: h.matched_keywords ?? [],
    publishedAt: h.published_at,
    createdAt: h.created_at,
  }
}

export async function fetchMonitorHits(
  supabase: SupabaseClient,
  limit = MONITOR_HITS_LIMIT,
): Promise<MonitorHit[]> {
  const { data, error } = await supabase
    .from('monitor_hits')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((h) => monitorHitFromRow(h as MonitorHitRow))
}

export function buildEventReviewSummaries(eventReviews: EventReview[]): EventReviewSummary[] {
  const grouped = new Map<string, EventReview[]>()
  for (const review of eventReviews) {
    const list = grouped.get(review.recruitmentId) ?? []
    list.push(review)
    grouped.set(review.recruitmentId, list)
  }

  return [...grouped.entries()].map(([recruitmentId, reviews]) => {
    const count = reviews.length
    const avgSales = reviews.reduce((sum, r) => sum + r.ratingSales, 0) / count
    const avgTraffic = reviews.reduce((sum, r) => sum + r.ratingTraffic, 0) / count
    const avgOrganizer = reviews.reduce((sum, r) => sum + r.ratingOrganizer, 0) / count
    const tagCounts = new Map<string, number>()
    for (const review of reviews) {
      for (const tag of review.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      }
    }
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag)

    return {
      recruitmentId,
      count,
      avgSales,
      avgTraffic,
      avgOrganizer,
      avgOverall: (avgSales + avgTraffic + avgOrganizer) / 3,
      topTags,
    }
  })
}

export async function fetchWorkspace(
  supabase: SupabaseClient,
  userId: string,
  options: {
    monitorHitsLimit?: number
    eventsLimit?: number
    includeClosedEvents?: boolean
  } = {},
): Promise<WorkspaceData> {
  const monitorHitsLimit = options.monitorHitsLimit ?? MONITOR_HITS_LIMIT
  const eventsLimit = options.eventsLimit ?? EVENTS_LIMIT
  const includeClosedEvents = options.includeClosedEvents ?? false

  let eventsQuery = supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(eventsLimit)
  if (!includeClosedEvents) {
    eventsQuery = eventsQuery.eq('status', 'open')
  }

  const [recruitmentsRes, applicationsRes, profileRes, notificationsRes, postsRes, reviewsRes, eventReviewsRes, chatRes, monitorHitsRes, eventsRes] =
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
        .from('event_reviews')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('event_chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(500),
      supabase
        .from('monitor_hits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(monitorHitsLimit),
      eventsQuery,
    ])

  if (recruitmentsRes.error) throw recruitmentsRes.error
  if (applicationsRes.error) throw applicationsRes.error
  if (profileRes.error) throw profileRes.error

  const recruitments = (recruitmentsRes.data ?? []).map((row) =>
    recruitmentFromRow(row as RecruitmentRow),
  )
  const recruitmentMap = new Map(recruitments.map((r) => [r.id, r]))

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
      region: p.region ?? p.area ?? '',
      recruitmentId: p.recruitment_id ?? null,
      createdAt: p.created_at,
      reviewCount: postReviews.length,
      avgRating,
    }
  })

  const eventReviews = (eventReviewsRes.error ? [] : (eventReviewsRes.data ?? [])).map((row) => {
    const recruitment = recruitmentMap.get(row.recruitment_id)
    return {
      id: row.id,
      recruitmentId: row.recruitment_id,
      userId: row.user_id,
      authorName: row.author_name ?? '',
      ratingSales: row.rating_sales,
      ratingTraffic: row.rating_traffic,
      ratingOrganizer: row.rating_organizer,
      body: row.body ?? '',
      tags: row.tags ?? [],
      createdAt: row.created_at,
      eventTitle: recruitment?.title ?? 'イベント',
      eventArea: recruitment?.area ?? '',
      eventVenue: recruitment?.venue ?? '',
    }
  })

  const eventChatMessages = (chatRes.error ? [] : (chatRes.data ?? [])).map((row) => ({
    id: row.id,
    recruitmentId: row.recruitment_id,
    userId: row.user_id,
    authorName: row.author_name ?? '',
    body: row.body,
    createdAt: row.created_at,
  }))

  return {
    recruitments,
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
    eventReviews,
    eventChatMessages,
    monitorHits: (monitorHitsRes.error ? [] : (monitorHitsRes.data ?? [])).map((h) =>
      monitorHitFromRow(h as MonitorHitRow),
    ),
    collectedEvents: (eventsRes.error ? [] : (eventsRes.data ?? [])).map((row) =>
      eventFromRow(row as EventRow),
    ),
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
    region: form.area.trim(),
    genre: form.genre.trim(),
    recruitment_id: null,
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

export async function insertEventReview(
  supabase: SupabaseClient,
  userId: string,
  authorName: string,
  form: EventReviewForm,
): Promise<void> {
  const { error } = await supabase.from('event_reviews').insert({
    recruitment_id: form.recruitmentId,
    user_id: userId,
    author_name: authorName,
    rating_sales: form.ratingSales,
    rating_traffic: form.ratingTraffic,
    rating_organizer: form.ratingOrganizer,
    body: form.body.trim(),
    tags: form.tags,
  })
  if (error) throw error
}

export async function insertEventChatMessage(
  supabase: SupabaseClient,
  userId: string,
  authorName: string,
  recruitmentId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.from('event_chat_messages').insert({
    recruitment_id: recruitmentId,
    user_id: userId,
    author_name: authorName,
    body: body.trim(),
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
