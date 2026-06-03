import type { MouseEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import { useUrlAvailability } from '../../hooks/useUrlAvailability'
import type { UrlAvailability } from '../../lib/urlAvailability'

type Props = {
  url: string
  className?: string
  iconSize?: number
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  /** 親で一括チェック済みの場合に渡す */
  availability?: UrlAvailability
}

export function SourceLink({
  url,
  className,
  iconSize = 14,
  onClick,
  availability: availabilityProp,
}: Props) {
  const checked = useUrlAvailability(availabilityProp ? null : url)
  const availability = availabilityProp ?? checked

  if (availability === 'unavailable') {
    return (
      <span className={`source-link--unavailable ${className ?? ''}`.trim()} aria-live="polite">
        元サイトは表示できません（ページが見つかりません）
      </span>
    )
  }

  return (
    <a
      className={className}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
    >
      元サイトを見る
      <ExternalLink size={iconSize} />
    </a>
  )
}
