import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CaretBottomIcon, CaretUpIcon } from './icons'

export type DropdownOption = {
  value: string
  label: string
  disabled?: boolean
}

type DropdownProps = {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

function getEnabledIndex(options: DropdownOption[], fromIndex: number, direction: 1 | -1) {
  if (options.length === 0) return -1

  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (fromIndex + direction * offset + options.length) % options.length
    if (!options[index]?.disabled) return index
  }

  return -1
}

export default function Dropdown({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  ariaLabel,
}: DropdownProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const selectedIndex = options.findIndex((option) => option.value === value)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null
  const listboxId = `${id}-listbox`
  const activeOptionId = activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
  const classes = ['dropdown', className].filter(Boolean).join(' ')

  const firstEnabledIndex = useMemo(
    () => options.findIndex((option) => !option.disabled),
    [options],
  )

  useEffect(() => {
    if (!open) {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex)
    }
  }, [firstEnabledIndex, open, selectedIndex])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open || activeIndex < 0) return

    document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeIndex, id, open])

  const moveActive = (direction: 1 | -1) => {
    const baseIndex = activeIndex >= 0 ? activeIndex + direction : selectedIndex + direction
    const nextIndex = getEnabledIndex(options, baseIndex, direction)
    if (nextIndex >= 0) setActiveIndex(nextIndex)
  }

  const selectIndex = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return

    onChange(option.value)
    setActiveIndex(index)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={rootRef} className={classes}>
      <button
        ref={buttonRef}
        type="button"
        className="dropdown-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? activeOptionId : undefined}
        onClick={() => {
          if (disabled) return
          setOpen((nextOpen) => !nextOpen)
          setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex)
        }}
        onKeyDown={(event) => {
          if (disabled) return

          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex)
              return
            }
            moveActive(event.key === 'ArrowDown' ? 1 : -1)
            return
          }

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!open) {
              setOpen(true)
              setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex)
              return
            }
            selectIndex(activeIndex)
            return
          }

          if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
            setOpen(false)
          }
        }}
      >
        <span className={`dropdown-value${selectedOption ? '' : ' is-placeholder'}`}>
          {selectedOption?.label || ''}
        </span>
        <span className="dropdown-caret">
          {open ? <CaretUpIcon size={16} /> : <CaretBottomIcon size={16} />}
        </span>
      </button>

      {open ? (
        <div id={listboxId} className="dropdown-listbox" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              key={`${option.value}-${index}`}
              id={`${id}-option-${index}`}
              type="button"
              tabIndex={-1}
              className={`dropdown-option${index === selectedIndex ? ' is-selected' : ''}${index === activeIndex ? ' is-active' : ''}`}
              role="option"
              aria-selected={index === selectedIndex}
              aria-disabled={option.disabled || undefined}
              onPointerDown={(event) => {
                if (option.disabled) event.preventDefault()
              }}
              onMouseEnter={() => {
                if (!option.disabled) setActiveIndex(index)
              }}
              onClick={() => selectIndex(index)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
