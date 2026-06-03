type Props = {
  label: string
  value: number
  onChange: (value: number) => void
}

export function StarRatingInput({ label, value, onChange }: Props) {
  return (
    <div className="form-field">
      <label className="form-field__label">{label}</label>
      <div className="rating-picker" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`rating-picker__star${value >= n ? ' rating-picker__star--active' : ''}`}
            onClick={() => onChange(n)}
            aria-label={`${n}つ星`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}
