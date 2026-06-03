import { useMemo, useState } from 'react'
import { Bell, MapPin, Search, X } from 'lucide-react'
import { canViewFullMonitorFeed } from '../../lib/authConfig'
import { APP_NAME, APP_TAGLINE, FREE_AI_HIT_LIMIT, REGION_LABEL } from '../../lib/brand'
import { hasPaidAccess } from '../../lib/billing'
import {
  deriveEventAreas,
  filterDisplayEvents,
  mergeEventList,
} from '../../lib/eventList'
import { filterActiveRecruitments } from '../../lib/recruitmentStatus'
import { formatError } from '../../lib/formatError'
import { useAuth } from '../../hooks/useAuth'
import type { TabId } from '../../types'
import { EventCard } from './EventCard'
import { EventDetailScreen } from './EventDetailScreen'
import '../shared/shared.css'
import './home.css'

type Props = {
  onNavigateTab: (tab: TabId) => void
}

export function HomeScreen({ onNavigateTab }: Props) {
  const {
    recruitments,
    collectedEvents,
    applications,
    appliedRecruitmentIds,
    applyToRecruitment,
    confirmShop,
    workspaceLoading,
    workspaceError,
    refreshWorkspace,
    unreadNotificationCount,
    profile,
    session,
  } = useAuth()

  const [confirmBusyId, setConfirmBusyId] = useState<string | null>(null)
  const [area, setArea] = useState('すべて')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [applyBusyId, setApplyBusyId] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)

  const fullAccess = canViewFullMonitorFeed(session?.user?.email)
  const paid = hasPaidAccess(profile) || fullAccess

  const activeRecruitments = useMemo(
    () => filterActiveRecruitments(recruitments),
    [recruitments],
  )

  const allEvents = useMemo(
    () =>
      mergeEventList(collectedEvents, activeRecruitments, {
        includeClosed: fullAccess,
      }),
    [collectedEvents, activeRecruitments, fullAccess],
  )

  const areas = useMemo(() => deriveEventAreas(allEvents), [allEvents])

  const filtered = useMemo(
    () => filterDisplayEvents(allEvents, { area, search }),
    [allEvents, area, search],
  )

  const displayLimit = paid ? filtered.length : FREE_AI_HIT_LIMIT
  const visible = filtered.slice(0, displayLimit)
  const hiddenCount = Math.max(0, filtered.length - displayLimit)

  const detailEvent = detailId ? allEvents.find((e) => e.id === detailId) ?? null : null

  const todayCount = allEvents.filter((e) => e.isNew && e.status === 'open').length
  const urgentCount = allEvents.filter((e) => e.isUrgent && e.status === 'open').length
  const pendingApplications = applications.filter((a) => a.status === 'pending').length

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

  const detailApplication =
    detailEvent?.recruitmentId
      ? applications.find((a) => a.recruitmentId === detailEvent.recruitmentId) ?? null
      : null

  const handleConfirmShop = async (applicationId: string) => {
    setApplyError(null)
    setConfirmBusyId(applicationId)
    try {
      await confirmShop(applicationId)
    } catch (err) {
      setApplyError(formatError(err))
    } finally {
      setConfirmBusyId(null)
    }
  }

  if (detailEvent) {
    return (
      <EventDetailScreen
        event={detailEvent}
        applied={
          detailEvent.recruitmentId
            ? appliedRecruitmentIds.has(detailEvent.recruitmentId)
            : false
        }
        applyBusy={
          detailEvent.recruitmentId ? applyBusyId === detailEvent.recruitmentId : false
        }
        confirmBusy={detailApplication ? confirmBusyId === detailApplication.id : false}
        onBack={() => setDetailId(null)}
        onApply={() => {
          if (detailEvent.recruitmentId) void handleApply(detailEvent.recruitmentId)
        }}
        onConfirmShop={
          detailApplication?.status === 'pending'
            ? () => void handleConfirmShop(detailApplication.id)
            : undefined
        }
      />
    )
  }

  return (
    <div className="screen">
      <header className="home-header">
        <div className="home-header__top">
          <div>
            <p className="home-header__greeting">{APP_NAME} · {REGION_LABEL}</p>
            <h1 className="home-header__title">{APP_TAGLINE}</h1>
            <p className="home-header__tagline">AIが21ソースから東海の出店募集を自動収集</p>
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
              placeholder="キーワードで検索（会場・エリア）"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="home-search__clear"
                onClick={() => setSearch('')}
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
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              style={{ display: 'block', marginTop: 8, fontWeight: 700, color: 'var(--color-primary)' }}
            >
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
              <button
                type="button"
                className="filter-clear"
                onClick={() => setArea('すべて')}
              >
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
                onClick={() => setArea(a)}
              >
                {a}
              </button>
            ))}
          </div>

          {area !== 'すべて' || search ? (
            <p className="filter-result-hint">
              {filtered.length}件ヒット
              {search ? `（「${search}」）` : ''}
              {fullAccess ? ' · テスト: 終了済み含む' : ''}
            </p>
          ) : null}
        </section>

        <div className="section-header">
          <h2 className="section-header__title">出店募集一覧</h2>
          <span className="section-header__count">{visible.length}件</span>
        </div>

        {visible.length > 0 ? (
          <>
            <div className="card-grid">
              {visible.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  applied={
                    event.recruitmentId
                      ? appliedRecruitmentIds.has(event.recruitmentId)
                      : false
                  }
                  applyBusy={
                    event.recruitmentId ? applyBusyId === event.recruitmentId : false
                  }
                  onOpen={() => setDetailId(event.id)}
                  onApply={() => {
                    if (event.recruitmentId) void handleApply(event.recruitmentId)
                  }}
                />
              ))}
            </div>

            {hiddenCount > 0 && (
              <div className="ai-feed__upgrade">
                <p>他 {hiddenCount} 件の募集があります</p>
                <button type="button" className="ai-feed__upgrade-btn" onClick={() => onNavigateTab('profile')}>
                  プランを見る
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="home-empty">
            {collectedEvents.length === 0 && activeRecruitments.length === 0
              ? '東海地方（三重・静岡・愛知・岐阜）の募集中イベントがありません。AIが1時間ごとに収集しています。'
              : '条件に合う募集がありません。フィルターを変更してください。'}
          </p>
        )}
      </div>
    </div>
  )
}
