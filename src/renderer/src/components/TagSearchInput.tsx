import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

export type TagSearchOption = {
  id: number
  name: string
  count?: number
}

type TagSearchInputProps = {
  value: string
  options: TagSearchOption[]
  placeholder?: string
  ariaLabel?: string
  showTagId?: boolean
  maxOptions?: number
  countSort?: 'asc' | 'desc'
  disabled?: boolean
  closeOnCommit?: boolean
  clearLabel?: string
  onChange: (value: string) => void
  onCommit: (value: string) => void
  onClearError?: () => void
}

function normalizeTagSearchValue(value: string) {
  return value.trim().toLocaleLowerCase()
}

export default function TagSearchInput({
  value,
  options,
  placeholder,
  ariaLabel,
  showTagId = false,
  maxOptions = 20,
  countSort,
  disabled = false,
  closeOnCommit = false,
  clearLabel,
  onChange,
  onCommit,
  onClearError,
}: TagSearchInputProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isComposing, setIsComposing] = useState(false)
  const query = normalizeTagSearchValue(value)

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query
    const matches = options
      .filter((option) => {
        if (!normalizedQuery) return true
        return option.name.toLocaleLowerCase().includes(normalizedQuery)
          || (showTagId && `#${option.id}`.includes(normalizedQuery))
      })
    if (countSort) {
      matches.sort((a, b) => {
        const difference = (a.count ?? 0) - (b.count ?? 0)
        return (countSort === 'asc' ? difference : -difference)
          || a.name.localeCompare(b.name) || a.id - b.id
      })
    }
    return matches.slice(0, maxOptions)
  }, [options, query, showTagId, maxOptions, countSort])

  const listboxId = `${id}-listbox`
  const activeOptionId = activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
  const canShowList = !disabled && open && filteredOptions.length > 0

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    setActiveIndex(filteredOptions.length > 0 ? 0 : -1)
  }, [filteredOptions, open])

  useEffect(() => {
    if (!canShowList || activeIndex < 0) return

    document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeIndex, canShowList, id])

  const commitValue = (nextValue: string, keepOpen = false) => {
    const trimmed = nextValue.trim()
    if (!trimmed) return

    onCommit(trimmed)
    if (closeOnCommit) inputRef.current?.focus()
    setOpen(closeOnCommit ? false : keepOpen)
    setActiveIndex(-1)
    if (!closeOnCommit) window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const moveActive = (direction: 1 | -1) => {
    if (!filteredOptions.length) return

    setActiveIndex((current) => {
      if (current < 0) return direction === 1 ? 0 : filteredOptions.length - 1
      return (current + direction + filteredOptions.length) % filteredOptions.length
    })
  }

  return (
    <div ref={rootRef} className="tag-search-input" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }}>
      <div className={`tag-search-input-control${clearLabel ? ' has-clear-button' : ''}`}>
      <input
        ref={inputRef}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={canShowList}
        aria-controls={listboxId}
        aria-activedescendant={canShowList ? activeOptionId : undefined}
        data-expanded={canShowList || undefined}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value)
          onClearError?.()
          setOpen(true)
        }}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            moveActive(event.key === 'ArrowDown' ? 1 : -1)
            return
          }

          if (event.key === 'Enter' && !isComposing) {
            event.preventDefault()
            const selectedOption = activeIndex >= 0 ? filteredOptions[activeIndex] : null
            commitValue(selectedOption?.name || value)
            return
          }

          if (event.key === 'Escape') {
            setOpen(false)
            setActiveIndex(-1)
            return
          }

          if (event.key === 'Tab') {
            setOpen(false)
            setActiveIndex(-1)
          }
        }}
      />
      {clearLabel && value ? (
        <button
          type="button"
          className="tag-search-clear-button"
          aria-label={ariaLabel ? `${ariaLabel}: ${clearLabel}` : clearLabel}
          title={clearLabel}
          disabled={disabled}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange('')
            onClearError?.()
            inputRef.current?.focus()
            setOpen(false)
            setActiveIndex(-1)
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
            <path d="m8.5 8.5 7 7m0-7-7 7" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
      </div>

      {canShowList ? (
        <div id={listboxId} className="tag-search-listbox" role="listbox" aria-label={ariaLabel}>
          {filteredOptions.map((option, index) => (
            <div
              key={option.id}
              id={`${id}-option-${index}`}
              className={`tag-search-option${showTagId ? ' has-tag-id' : ''}${index === activeIndex ? ' is-active' : ''}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => commitValue(option.name, true)}
            >
              <span className="tag-search-option-name">{option.name}</span>
              {showTagId ? <span className="tag-search-option-id">#{option.id}</span> : null}
              {typeof option.count === 'number' ? (
                <span className="tag-search-option-count">{option.count}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
