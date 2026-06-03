export type TabId = 'home' | 'calendar' | 'notifications' | 'profile'

export type CollectedEvent = {
  id: string
  monitorHitId: string | null
  recruitmentId: string | null
  sourceId: string | null
  origin: 'collected' | 'host'
  title: string
  organizer: string
  location: string
  area: string
  eventDate: string | null
  recruitStart: string | null
  recruitEnd: string | null
  fee: string
  category: string
  applicationUrl: string | null
  sourceUrl: string | null
  description: string
  status: 'open' | 'closed'
  confidence: number
  createdAt: string
}

/** ホーム一覧用（主催者募集 + AI収集を統合） */
export type DisplayEvent = {
  id: string
  title: string
  organizer: string
  location: string
  area: string
  eventDate: string | null
  recruitEnd: string | null
  feeLabel: string
  category: string
  applicationUrl: string | null
  sourceUrl: string | null
  sourceId: string | null
  origin: 'collected' | 'host'
  recruitmentId: string | null
  description: string
  isNew: boolean
  isUrgent: boolean
  imageGradient: string
  applicants: number
  maxApplicants: number
  timeSlot: string
  status: 'open' | 'closed'
}

export type MonitorHit = {
  id: string
  sourceId: string
  title: string
  url: string | null
  snippet: string
  matchedKeywords: string[]
  publishedAt: string | null
  createdAt: string
}

export type Recruitment = {
  id: string
  title: string
  venue: string
  area: string
  genre: string
  date: string
  timeSlot: string
  fee: number
  applicants: number
  maxApplicants: number
  isNew: boolean
  isUrgent: boolean
  imageGradient: string
  description: string
  sourceUrl: string | null
}

export type ApplicationRecord = {
  id: string
  recruitmentId: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  confirmedAt: string | null
}

export type CalendarEvent = {
  id: string
  recruitmentId: string
  title: string
  venue: string
  area: string
  date: string
  timeSlot: string
  status: ApplicationRecord['status']
  fee: number
}

export type NotificationRecord = {
  id: string
  type: 'application' | 'recruitment' | 'community' | 'system'
  title: string
  body: string
  relatedId: string | null
  actionUrl: string | null
  isRead: boolean
  createdAt: string
}

export type EventReview = {
  id: string
  recruitmentId: string
  userId: string
  authorName: string
  ratingSales: number
  ratingTraffic: number
  ratingOrganizer: number
  body: string
  tags: string[]
  createdAt: string
  eventTitle: string
  eventArea: string
  eventVenue: string
}

export type EventReviewForm = {
  recruitmentId: string
  ratingSales: number
  ratingTraffic: number
  ratingOrganizer: number
  body: string
  tags: string[]
}

export type EventReviewSummary = {
  recruitmentId: string
  count: number
  avgSales: number
  avgTraffic: number
  avgOrganizer: number
  avgOverall: number
  topTags: string[]
}

export type EventChatMessage = {
  id: string
  recruitmentId: string
  userId: string
  authorName: string
  body: string
  createdAt: string
}

export type CommunityPost = {
  id: string
  userId: string
  authorName: string
  title: string
  body: string
  area: string
  genre: string
  region: string
  recruitmentId: string | null
  createdAt: string
  reviewCount: number
  avgRating: number
}

export type CommunityReview = {
  id: string
  postId: string
  userId: string
  authorName: string
  rating: number
  body: string
  createdAt: string
}

export type Profile = {
  id: string
  displayName: string
  businessName: string
  genre: string
  area: string
  subscriptionPlan: 'free' | 'standard' | 'premium'
  subscriptionStatus: 'none' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  xAutoPost: boolean
}

export type ProfileForm = {
  displayName: string
  businessName: string
  genre: string
  area: string
  xAutoPost?: boolean
}

export type CommunityPostForm = {
  title: string
  body: string
  area: string
  genre: string
}

export type CommunityReviewForm = {
  rating: number
  body: string
}

export type RecruitmentFilters = {
  area: string
  genre: string
  search: string
}

export type CommunityIntent = {
  action?: 'review' | 'chat'
  recruitmentId?: string
}
