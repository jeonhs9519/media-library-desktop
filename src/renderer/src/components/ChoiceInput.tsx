import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type ChoiceInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  type: 'checkbox' | 'radio'
  children: ReactNode
}

export default function ChoiceInput({
  type,
  children,
  className = '',
  ...inputProps
}: ChoiceInputProps) {
  const classes = ['choice-input', className].filter(Boolean).join(' ')

  return (
    <label className={classes}>
      <input type={type} {...inputProps} />
      <span className="choice-input-content">{children}</span>
    </label>
  )
}
