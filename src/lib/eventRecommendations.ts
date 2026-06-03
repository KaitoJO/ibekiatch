import type { EventReview, Profile, Recruitment } from '../types'

export type RecommendedEvent = {
  recruitment: Recruitment
  reason: string
  score: number
}

function avgReviewScore(reviews: EventReview[]): number {
  if (reviews.length === 0) return 0
  const sum = reviews.reduce(
    (acc, r) => acc + (r.ratingSales + r.ratingTraffic + r.ratingOrganizer) / 3,
    0,
  )
  return sum / reviews.length
}

function topTagsForRecruitment(reviews: EventReview[]): string[] {
  const counts = new Map<string, number>()
  for (const review of reviews) {
    for (const tag of review.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([tag]) => tag)
}

export function buildRecommendedEvents(
  recruitments: Recruitment[],
  eventReviews: EventReview[],
  profile: Profile | null,
  limit = 3,
): RecommendedEvent[] {
  const reviewsByRecruitment = new Map<string, EventReview[]>()
  for (const review of eventReviews) {
    const list = reviewsByRecruitment.get(review.recruitmentId) ?? []
    list.push(review)
    reviewsByRecruitment.set(review.recruitmentId, list)
  }

  const profileArea = profile?.area?.trim() ?? ''

  const scored = recruitments
    .map((recruitment) => {
      const reviews = reviewsByRecruitment.get(recruitment.id) ?? []
      const rating = avgReviewScore(reviews)
      const tags = topTagsForRecruitment(reviews)
      let score = rating * 10 + reviews.length * 2
      if (profileArea && recruitment.area.includes(profileArea)) score += 5
      if (recruitment.isNew) score += 1
      if (reviews.length === 0) score = 0

      let reason = '出店者の口コミ評価が高いイベントです'
      if (tags.length > 0) {
        reason = `「${tags.join('」「')}」の声が多いイベントです`
      } else if (profileArea && recruitment.area.includes(profileArea)) {
        reason = `活動エリア（${profileArea}）に近いイベントです`
      }

      return { recruitment, reason, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit)
}
