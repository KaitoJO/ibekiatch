import type { LucideIcon } from 'lucide-react'

type Props = {
  icon: LucideIcon
  title: string
  description: string
}

export function PlaceholderScreen({ icon: Icon, title, description }: Props) {
  return (
    <div className="placeholder-screen screen">
      <div className="placeholder-screen__icon">
        <Icon size={32} strokeWidth={1.75} />
      </div>
      <h2 className="placeholder-screen__title">{title}</h2>
      <p className="placeholder-screen__desc">{description}</p>
    </div>
  )
}
