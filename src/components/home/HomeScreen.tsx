import { useMemo, useRef, useState } from 'react'
import { Bell, MapPin, Search, SlidersHorizontal, X } from 'lucide-react'
import { deriveFilterOptions, filterRecruitments, formatFee } from '../../lib/recruitmentUtils'
import { formatError } from '../../lib/formatError'
import { useAuth } from '../../hooks/useAuth'
import type { TabId } from '../../types'
import { RecruitmentCard } from './RecruitmentCard'
import { RecruitmentDetailScreen } from './RecruitmentDetailScreen'
import '../shared/shared.css'
import './home.css'

type Props = {
  onNavigateTab: (tab: TabId) => void
}

export function HomeScreen({ onNavigateTab }: Props) {
  const {
    recruitments,
    applications,
    appliedRecruitmentIds,
    applyToRecruitment,
    workspaceLoading,
    workspaceError,
    refreshWorkspace,
    unreadNotificationCount,
  } = useAuth()

  const [area, setArea] = useState('すべて')
  const [genre, setGenre] = useState('すべて')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeCard, setActiveCard] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [applyBusyId, setApplyBusyId] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  const { areas, genres } = useMemo(() => deriveFilterOptions(recruitments), [recruitments])

  const filtered = useMemo(
    () => filterRecruitments(recruitments, { area, genre, search }),
    [recruitments, area, genre, search],
  )

  const detailRecruitment = detailId
    ? recruitments.find((r) => r.id === detailId) ?? null
    : null

  const todayCount = recruitments.filter((r) => r.isNew).length
  const urgentCount = recruitments.filter((r) => r.isUrgent).length
  const pendingApplications = applications.filter((a) => a.status === 'pending').length

  const handleScroll = () => {
    const el = carouselRef.current
    if (!el || filtered.length === 0) return
    const cardWidth = el.scrollWidth / filtered.length
    const index = Math.round(el.scrollLeft / cardWidth)
    setActiveCard(Math.min(index, filtered.length - 1))
  }

  const resetCarousel = () => {
    setActiveCard(0)
    if (carouselRef.current) carouselRef.current.scrollLeft = 0
  }

  const handleApply = async (recruitmentId: string) => {
    setApplyError(null)
    setApplyBusyId(recruitmentId)
    try {
      await applyToRecruitment(recruitmentId)
    } catch (err) {
      setApplyError(formatError(err))
    } finally {
      setApplyBusyId(null)
    }
  }

  if (detailRecruitment) {
    return (
      <RecruitmentDetailScreen
        recruitment={detailRecruitment}
        applied={appliedRecruitmentIds.has(detailRecruitment.id)}
        applyBusy={applyBusyId === detailRecruitment.id}
        onBack={() => setDetailId(null)}
        onApply={() => void handleApply(detailRecruitment.id)}
      />
    )
  }

  return (
    <div className="screen">
      <header className="home-header">
        <div className="home-header__top">
          <div>
            <p className="home-header__greeting">おはようございます 👋</p>
            <h1 className="home-header__title">今日の出店募集</h1>
          </div>
          <div className="home-header__actions">
            <button
              type="button"
              className="home-header__btn"
              aria-label="検索"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search size={20} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="home-header__btn"
              aria-label="通知"
              onClick={() => onNavigateTab('notifications')}
            >
              <Bell size={20} strokeWidth={2} />
              {unreadNotificationCount > 0 && <span className="home-header__btn-dot" />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="home-search">
            <input
              type="search"
              className="home-search__input"
              placeholder="キーワードで検索（会場・エリア・ジャンル）"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                resetCarousel()
              }}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="home-search__clear"
                onClick={() => {
                  setSearch('')
                  resetCarousel()
                }}
                aria-label="検索をクリア"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        <div className="home-stats">
          <div className="home-stat">
            <div className="home-stat__value">{todayCount}</div>
            <div className="home-stat__label">本日の新着</div>
          </div>
          <div className="home-stat">
            <div className="home-stat__value">{urgentCount}</div>
            <div className="home-stat__label">急募案件</div>
          </div>
          <div className="home-stat">
            <div className="home-stat__value">{pendingApplications}</div>
            <div className="home-stat__label">応募中</div>
          </div>
        </div>
      </header>

      <div className="home-body">
        {workspaceLoading && (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            データを読み込み中…
          </p>
        )}
        {workspaceError && (
          <div className="alert alert--error">
            {workspaceError}
            <button type="button" onClick={() => void refreshWorkspace()} style={{ display: 'block', marginTop: 8, fontWeight: 700, color: 'var(--color-primary)' }}>
              再読み込み
            </button>
          </div>
        )}
        {applyError && <div className="alert alert--error">{applyError}</div>}

        <section className="filter-section" aria-label="フィルター">
          <div className="filter-section__label">
            <MapPin size={14} />
            エリア
            {area !== 'すべて' && (
              <button type="button" className="filter-clear" onClick={() => { setArea('すべて'); resetCarousel() }}>
                クリア
              </button>
            )}
          </div>
          <div className="filter-chips">
            {areas.map((a) => (
              <button
                key={a}
                type="button"
                className={`filter-chip${area === a ? ' filter-chip--active' : ''}`}
                onClick={() => { setArea(a); resetCarousel() }}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="filter-section__label" style={{ marginTop: 14 }}>
            <SlidersHorizontal size={14} />
            ジャンル
            {genre !== 'すべて' && (
              <button type="button" className="filter-clear" onClick={() => { setGenre('すべて'); resetCarousel() }}>
                クリア
              </button>
            )}
          </div>
          <div className="filter-chips">
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                className={`filter-chip${genre === g ? ' filter-chip--active' : ''}`}
                onClick={() => { setGenre(g); resetCarousel() }}
              >
                {g}
              </button>
            ))}
          </div>

          {(area !== 'すべて' || genre !== 'すべて' || search) && (
            <p className="filter-result-hint">
              {filtered.length}件ヒット
              {search ? `（「${search}」）` : ''}
            </p>
          )}
        </section>

        <div className="section-header">
          <h2 className="section-header__title">スワイプで募集を見る</h2>
          <span className="section-header__count">{filtered.length}件</span>
        </div>

        {filtered.length > 0 ? (
          <>
            <div ref={carouselRef} className="card-carousel" onScroll={handleScroll}>
              {filtered.map((r) => (
                <RecruitmentCard
                  key={r.id}
                  recruitment={r}
                  applied={appliedRecruitmentIds.has(r.id)}
                  applyBusy={applyBusyId === r.id}
                  onOpen={() => setDetailId(r.id)}
                  onApply={() => void handleApply(r.id)}
                />
              ))}
            </div>

            <div className="carousel-dots" aria-hidden>
              {filtered.map((_, i) => (
                <span key={i} className={`carousel-dot${i === activeCard ? ' carousel-dot--active' : ''}`} />
              ))}
            </div>

            <section className="list-section">
              <div className="section-header">
                <h2 className="section-header__title">一覧</h2>
              </div>
              {filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="recruitment-list-item"
                  onClick={() => setDetailId(r.id)}
                >
                  <div className="recruitment-list-item__thumb" style={{ background: r.imageGradient }} />
                  <div className="recruitment-list-item__content">
                    <div className="recruitment-list-item__title">{r.title}</div>
                    <div className="recruitment-list-item__sub">
                      {r.area} · {r.genre}
                      {appliedRecruitmentIds.has(r.id) ? ' · 応募済み' : ''}
                    </div>
                  </div>
                  <div className="recruitment-list-item__fee">{formatFee(r.fee, true)}</div>
                </button>
              ))}
            </section>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon">🚚</div>
            <p className="empty-state__title">該当する募集がありません</p>
            <p>フィルターや検索条件を変更してみてください。</p>
          </div>
        )}
      </div>
    </div>
  )
}
