import { useEffect, useState } from 'react'
import { AREAS, GENRES } from '../../data/mockRecruitments'
import { useAuth } from '../../hooks/useAuth'
import { formatDateTime, formatFee } from '../../lib/recruitmentUtils'
import { ScreenHeader } from '../shared/ScreenHeader'
import '../shared/shared.css'
import './profile.css'

const STATUS_LABEL = {
  pending: '審査中',
  accepted: '承認',
  rejected: '不採用',
} as const

export function ProfileScreen() {
  const {
    session,
    profile,
    applications,
    recruitments,
    saveProfile,
    signOut,
    workspaceLoading,
  } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [genre, setGenre] = useState('')
  const [area, setArea] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '')
    setBusinessName(profile?.businessName ?? '')
    setGenre(profile?.genre ?? '')
    setArea(profile?.area ?? '')
  }, [profile])

  const recruitmentMap = new Map(recruitments.map((r) => [r.id, r]))

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      await saveProfile({ displayName, businessName, genre, area })
      setMessage({ type: 'ok', text: 'プロフィールを保存しました。' })
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  const displayLabel =
    profile?.businessName || profile?.displayName || session?.user?.email?.split('@')[0] || 'ゲスト'

  return (
    <div className="profile-screen screen">
      <ScreenHeader title="マイページ" gradient />

      <header className="profile-header profile-header--compact">
        <div className="profile-header__avatar" aria-hidden>🚚</div>
        <h1 className="profile-header__name">{displayLabel}</h1>
        <p className="profile-header__email">{session?.user?.email ?? ''}</p>

        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat__value">{applications.length}</div>
            <div className="profile-stat__label">応募数</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat__value">
              {applications.filter((a) => a.status === 'accepted').length}
            </div>
            <div className="profile-stat__label">承認済み</div>
          </div>
        </div>
      </header>

      <div className="profile-body">
        <section className="profile-card">
          <h2 className="profile-card__title">プロフィール</h2>
          <form onSubmit={onSave}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="display-name">表示名</label>
              <input
                id="display-name"
                className="form-field__input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="山田 太郎"
              />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="business-name">キッチンカー名</label>
              <input
                id="business-name"
                className="form-field__input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Smile Kitchen"
              />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="profile-genre">ジャンル</label>
              <select
                id="profile-genre"
                className="form-field__select"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                <option value="">選択してください</option>
                {GENRES.filter((g) => g !== 'すべて').map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="profile-area">活動エリア</label>
              <select
                id="profile-area"
                className="form-field__select"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                <option value="">選択してください</option>
                {AREAS.filter((a) => a !== 'すべて').map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {message && (
              <div className={`alert alert--${message.type === 'ok' ? 'success' : 'error'}`}>
                {message.text}
              </div>
            )}

            <button type="submit" className="primary-btn" disabled={busy || workspaceLoading}>
              {busy ? '保存中…' : 'プロフィールを保存'}
            </button>
          </form>
        </section>

        <section className="profile-card">
          <h2 className="profile-card__title">応募履歴</h2>
          {applications.length === 0 ? (
            <p className="profile-empty">まだ応募がありません。ホームから募集に応募してみましょう。</p>
          ) : (
            <div className="profile-applications">
              {applications.map((app) => {
                const recruitment = recruitmentMap.get(app.recruitmentId)
                return (
                  <div key={app.id} className="profile-application-item">
                    <div className="profile-application-item__main">
                      <div className="profile-application-item__title">
                        {recruitment?.title ?? '募集'}
                      </div>
                      {recruitment && (
                        <div className="profile-application-item__sub">
                          {recruitment.area} · {formatFee(recruitment.fee, true)} · {formatDateTime(app.createdAt)}
                        </div>
                      )}
                    </div>
                    <span className={`status-badge status-badge--${app.status}`}>
                      {STATUS_LABEL[app.status]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <button type="button" className="secondary-btn" onClick={() => void signOut()}>
          ログアウト
        </button>
      </div>
    </div>
  )
}
