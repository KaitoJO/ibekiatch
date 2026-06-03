import { useEffect, useState } from 'react'
import { AREAS } from '../../data/mockRecruitments'
import { hasPaidAccess, planRank, startCheckout, openBillingPortal, syncBillingFromStripe } from '../../lib/billing'
import { SUBSCRIPTION_PLANS } from '../../lib/brand'
import { formatError } from '../../lib/formatError'
import { useAuth } from '../../hooks/useAuth'
import { formatDateTime, formatFee } from '../../lib/recruitmentUtils'
import { ScreenHeader } from '../shared/ScreenHeader'
import '../shared/shared.css'
import './profile.css'

const STATUS_LABEL = {
  pending: '審査中',
  accepted: '出店確定',
  rejected: '不採用',
} as const

export function ProfileScreen() {
  const {
    session,
    profile,
    applications,
    recruitments,
    saveProfile,
    confirmShop,
    signOut,
    workspaceLoading,
    refreshWorkspace,
    authDisabled,
  } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [area, setArea] = useState('')
  const [xAutoPost, setXAutoPost] = useState(false)
  const [busy, setBusy] = useState(false)
  const [billingBusy, setBillingBusy] = useState<string | null>(null)
  const [confirmBusyId, setConfirmBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '')
    setBusinessName(profile?.businessName ?? '')
    setArea(profile?.area ?? '')
    setXAutoPost(profile?.xAutoPost ?? false)
  }, [profile])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success') {
      setMessage({ type: 'ok', text: 'お支払いが完了しました。プランを反映しています…' })
      void (async () => {
        try {
          if (session?.access_token) {
            await syncBillingFromStripe(session.access_token)
          }
        } catch {
          // Webhook 反映を待つ — refreshWorkspace で再取得
        }
        await refreshWorkspace()
        setMessage({ type: 'ok', text: 'お支払いが完了しました。プランが反映されました。' })
      })()
      window.history.replaceState(null, '', `${window.location.pathname}?tab=profile`)
    } else if (params.get('checkout') === 'cancel') {
      setMessage({ type: 'err', text: 'お支払いはキャンセルされました。' })
      window.history.replaceState(null, '', `${window.location.pathname}?tab=profile`)
    }
  }, [refreshWorkspace, session?.access_token])

  const recruitmentMap = new Map(recruitments.map((r) => [r.id, r]))
  const currentPlan = profile?.subscriptionPlan ?? 'free'
  const paid = hasPaidAccess(profile)
  const accessToken = session?.access_token

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      await saveProfile({ displayName, businessName, genre: profile?.genre ?? '', area, xAutoPost })
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

  const onSelectPlan = async (planId: 'standard' | 'premium') => {
    if (!accessToken) return
    setMessage(null)
    setBillingBusy(planId)
    try {
      const url = await startCheckout(accessToken, planId)
      window.location.href = url
    } catch (err) {
      setMessage({ type: 'err', text: formatError(err) })
      setBillingBusy(null)
    }
  }

  const onManageBilling = async () => {
    if (!accessToken) return
    setMessage(null)
    setBillingBusy('portal')
    try {
      const url = await openBillingPortal(accessToken)
      window.location.href = url
    } catch (err) {
      setMessage({ type: 'err', text: formatError(err) })
      setBillingBusy(null)
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
          <h2 className="profile-card__title">プラン</h2>
          <p className="profile-plan-intro">
            キッチンカー・移動販売・露天営業者向け。AI収集の全件表示はスタンダード以上。
          </p>
          {paid && (
            <p className="profile-plan-status">
              現在: <strong>{SUBSCRIPTION_PLANS.find((p) => p.id === currentPlan)?.name ?? currentPlan}</strong>
            </p>
          )}
          <div className="profile-plans">
            {SUBSCRIPTION_PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan && (plan.id === 'free' || paid)
              const canCheckout =
                plan.id !== 'free' &&
                accessToken &&
                (!paid || planRank(plan.id) > planRank(currentPlan))

              return (
                <div
                  key={plan.id}
                  className={`profile-plan${'recommended' in plan && plan.recommended ? ' profile-plan--recommended' : ''}${isCurrent ? ' profile-plan--current' : ''}`}
                >
                  {'recommended' in plan && plan.recommended && (
                    <span className="profile-plan__badge">おすすめ</span>
                  )}
                  {isCurrent && plan.id !== 'free' && (
                    <span className="profile-plan__badge profile-plan__badge--current">利用中</span>
                  )}
                  <div className="profile-plan__head">
                    <h3 className="profile-plan__name">{plan.name}</h3>
                    <p className="profile-plan__price">{plan.priceLabel}</p>
                  </div>
                  <ul className="profile-plan__features">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  {plan.id === 'free' ? null : isCurrent ? (
                    <button type="button" className="profile-plan__btn profile-plan__btn--current" disabled>
                      現在のプラン
                    </button>
                  ) : canCheckout ? (
                    <button
                      type="button"
                      className="profile-plan__btn"
                      disabled={billingBusy !== null}
                      onClick={() => void onSelectPlan(plan.id as 'standard' | 'premium')}
                    >
                      {billingBusy === plan.id ? 'Stripeへ…' : 'このプランにする'}
                    </button>
                  ) : paid ? (
                    <button
                      type="button"
                      className="profile-plan__btn profile-plan__btn--secondary"
                      disabled={billingBusy !== null}
                      onClick={() => void onManageBilling()}
                    >
                      プラン変更
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
          {paid && (
            <button
              type="button"
              className="profile-billing-portal"
              disabled={billingBusy !== null}
              onClick={() => void onManageBilling()}
            >
              {billingBusy === 'portal' ? '読み込み中…' : 'お支払い・解約の管理（Stripe）'}
            </button>
          )}
        </section>

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

            {profile?.subscriptionPlan === 'premium' && paid && (
              <label className="profile-checkbox">
                <input
                  type="checkbox"
                  checked={xAutoPost}
                  onChange={(e) => setXAutoPost(e.target.checked)}
                />
                出店確定時にXへ自動投稿（プレミアム）
              </label>
            )}

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
                    {app.status === 'pending' && (
                      <button
                        type="button"
                        className="profile-confirm-btn"
                        disabled={confirmBusyId === app.id}
                        onClick={() => {
                          setConfirmBusyId(app.id)
                          void confirmShop(app.id).finally(() => setConfirmBusyId(null))
                        }}
                      >
                        {confirmBusyId === app.id ? '…' : '出店確定'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {!authDisabled && (
          <button type="button" className="secondary-btn" onClick={() => void signOut()}>
            ログアウト
          </button>
        )}
      </div>
    </div>
  )
}
