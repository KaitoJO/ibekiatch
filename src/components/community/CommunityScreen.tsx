import { useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { AREAS, GENRES } from '../../data/mockRecruitments'
import { useAuth } from '../../hooks/useAuth'
import { formatDateTime } from '../../lib/recruitmentUtils'
import type { CommunityPost } from '../../types'
import { ScreenHeader } from '../shared/ScreenHeader'
import '../shared/shared.css'
import './community.css'

type View = 'list' | 'create' | 'detail'

export function CommunityScreen() {
  const {
    communityPosts,
    communityReviews,
    createCommunityPost,
    createCommunityReview,
    session,
  } = useAuth()

  const [view, setView] = useState<View>('list')
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [postForm, setPostForm] = useState({ title: '', body: '', area: '', genre: '' })
  const [reviewForm, setReviewForm] = useState({ rating: 5, body: '' })

  const selectedPost = useMemo(
    () => communityPosts.find((p) => p.id === selectedPostId) ?? null,
    [communityPosts, selectedPostId],
  )

  const postReviews = useMemo(
    () =>
      selectedPostId
        ? communityReviews.filter((r) => r.postId === selectedPostId)
        : [],
    [communityReviews, selectedPostId],
  )

  const myReview = postReviews.find((r) => r.userId === session?.user?.id)

  const openDetail = (post: CommunityPost) => {
    setSelectedPostId(post.id)
    setReviewForm({ rating: 5, body: '' })
    setError(null)
    setView('detail')
  }

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postForm.title.trim() || !postForm.body.trim()) {
      setError('タイトルと本文を入力してください。')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createCommunityPost(postForm)
      setPostForm({ title: '', body: '', area: '', genre: '' })
      setView('list')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPostId) return
    setBusy(true)
    setError(null)
    try {
      await createCommunityReview(selectedPostId, reviewForm)
      setReviewForm({ rating: 5, body: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (view === 'create') {
    return (
      <div className="community-screen screen">
        <ScreenHeader title="新規投稿" onBack={() => setView('list')} />
        <form className="community-form" onSubmit={handleCreatePost}>
          <div className="form-field">
            <label className="form-field__label">タイトル</label>
            <input
              className="form-field__input"
              value={postForm.title}
              onChange={(e) => setPostForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="例: 初出店で売上3万円達成！"
            />
          </div>
          <div className="form-field">
            <label className="form-field__label">エリア</label>
            <select
              className="form-field__select"
              value={postForm.area}
              onChange={(e) => setPostForm((f) => ({ ...f, area: e.target.value }))}
            >
              <option value="">選択してください</option>
              {AREAS.filter((a) => a !== 'すべて').map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-field__label">ジャンル</label>
            <select
              className="form-field__select"
              value={postForm.genre}
              onChange={(e) => setPostForm((f) => ({ ...f, genre: e.target.value }))}
            >
              <option value="">選択してください</option>
              {GENRES.filter((g) => g !== 'すべて').map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-field__label">本文</label>
            <textarea
              className="form-field__textarea"
              value={postForm.body}
              onChange={(e) => setPostForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="出店レポートやおすすめ情報をシェアしましょう"
            />
          </div>
          {error && <div className="alert alert--error">{error}</div>}
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? '投稿中…' : '投稿する'}
          </button>
        </form>
      </div>
    )
  }

  if (view === 'detail' && selectedPost) {
    return (
      <div className="community-screen screen">
        <ScreenHeader title="投稿詳細" onBack={() => { setView('list'); setSelectedPostId(null) }} />
        <div className="community-detail">
          <article className="community-post-card community-post-card--expanded">
            <div className="community-post-card__meta">
              <span>{selectedPost.authorName}</span>
              <span>{formatDateTime(selectedPost.createdAt)}</span>
            </div>
            <h2 className="community-post-card__title">{selectedPost.title}</h2>
            {(selectedPost.area || selectedPost.genre) && (
              <p className="community-post-card__tags">
                {[selectedPost.area, selectedPost.genre].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="community-post-card__body">{selectedPost.body}</p>
            <div className="community-post-card__rating">
              <Star size={14} fill="#FF6B35" color="#FF6B35" />
              {selectedPost.avgRating > 0 ? selectedPost.avgRating.toFixed(1) : '—'}
              <span>（{selectedPost.reviewCount}件のレビュー）</span>
            </div>
          </article>

          <section className="community-reviews">
            <h3 className="community-reviews__title">レビュー</h3>
            {postReviews.length === 0 ? (
              <p className="community-reviews__empty">まだレビューがありません。最初のレビューを投稿しましょう。</p>
            ) : (
              postReviews.map((r) => (
                <div key={r.id} className="community-review-item">
                  <div className="community-review-item__head">
                    <strong>{r.authorName}</strong>
                    <span className="community-review-item__stars">
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </span>
                  </div>
                  {r.body && <p className="community-review-item__body">{r.body}</p>}
                  <time className="community-review-item__time">{formatDateTime(r.createdAt)}</time>
                </div>
              ))
            )}
          </section>

          {!myReview && (
            <form className="community-form" onSubmit={handleCreateReview}>
              <h3 className="community-reviews__title">レビューを書く</h3>
              <div className="form-field">
                <label className="form-field__label">評価</label>
                <div className="rating-picker">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`rating-picker__star${reviewForm.rating >= n ? ' rating-picker__star--active' : ''}`}
                      onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                      aria-label={`${n}つ星`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label className="form-field__label">コメント</label>
                <textarea
                  className="form-field__textarea"
                  value={reviewForm.body}
                  onChange={(e) => setReviewForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="参考になった点など"
                />
              </div>
              {error && <div className="alert alert--error">{error}</div>}
              <button type="submit" className="primary-btn" disabled={busy}>
                {busy ? '送信中…' : 'レビューを投稿'}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="community-screen screen">
      <ScreenHeader
        title="コミュニティ"
        gradient
        actionLabel="投稿"
        onAction={() => { setError(null); setView('create') }}
      />

      <div className="community-body">
        {communityPosts.length === 0 ? (
          <div className="empty-block">
            <div className="empty-block__icon">💬</div>
            <p className="empty-block__title">投稿がありません</p>
            <p>右上の「投稿」から出店レポートをシェアしてみましょう。</p>
          </div>
        ) : (
          communityPosts.map((post) => (
            <button
              key={post.id}
              type="button"
              className="community-post-card"
              onClick={() => openDetail(post)}
            >
              <div className="community-post-card__meta">
                <span>{post.authorName}</span>
                <span>{formatDateTime(post.createdAt)}</span>
              </div>
              <h2 className="community-post-card__title">{post.title}</h2>
              {(post.area || post.genre) && (
                <p className="community-post-card__tags">
                  {[post.area, post.genre].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="community-post-card__excerpt">
                {post.body.length > 80 ? `${post.body.slice(0, 80)}…` : post.body}
              </p>
              <div className="community-post-card__rating">
                <Star size={14} fill="#FF6B35" color="#FF6B35" />
                {post.avgRating > 0 ? post.avgRating.toFixed(1) : '—'}
                <span>（{post.reviewCount}）</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
