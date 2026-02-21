import React from 'react'

interface Props {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
}

export default function StarRating({ value, onChange, readonly = false }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => !readonly && onChange?.(n)}
          style={{
            fontSize: 24,
            cursor: readonly ? 'default' : 'pointer',
            color: n <= value ? '#ffd700' : '#444',
            transition: 'color 0.1s',
          }}
        >
          ★
        </span>
      ))}
    </div>
  )
}
