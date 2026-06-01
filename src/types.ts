export type TabId = 'home' | 'calendar' | 'notifications' | 'community' | 'profile'

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
}

export type ApplicationRecord = {
  id: string
  recruitmentId: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
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
  isRead: boolean
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
}

export type ProfileForm = {
  displayName: string
  businessName: string
  genre: string
  area: string
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
