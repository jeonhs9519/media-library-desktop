import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { api } from '../api'
import { PasteIcon } from './icons'

interface Props {
  value: string
  onChange: (value: string) => void
  label: string
  pasteLabel: string
  pasteErrorLabel: string
  style?: CSSProperties
  inputStyle?: CSSProperties
}

export default function PasteInput({ value, onChange, label, pasteLabel, pasteErrorLabel, style, inputStyle }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null)
  const [pasting, setPasting] = useState(false)
  const [failed, setFailed] = useState(false)

  useLayoutEffect(() => {
    const selection = pendingSelectionRef.current
    const input = inputRef.current
    if (!selection || !input) return
    pendingSelectionRef.current = null
    input.focus()
    input.setSelectionRange(selection.start, selection.end)
  }, [value, pasting])

  const paste = async () => {
    const input = inputRef.current
    if (!input || pasting) return
    setPasting(true)
    setFailed(false)
    try {
      const text = (await api.clipboard.readText()).replace(/\r\n|\r|\n/g, ' ')
      pendingSelectionRef.current = { start: text.length, end: text.length }
      onChange(text)
    } catch {
      setFailed(true)
    } finally {
      setPasting(false)
    }
  }

  return (
    <div style={{ minWidth: 0, ...style }}>
      <div className="paste-input-control">
        <input
          ref={inputRef}
          value={value}
          aria-label={label}
          onChange={event => { setFailed(false); onChange(event.target.value) }}
          style={{ minWidth: 0, width: '100%', ...inputStyle, paddingRight: 34 }}
        />
        <button
          type="button"
          className="paste-input-button"
          aria-label={`${label}: ${pasteLabel}`}
          title={pasteLabel}
          disabled={pasting}
          onPointerDown={event => event.preventDefault()}
          onClick={() => { void paste() }}
        ><PasteIcon size={18} /></button>
      </div>
      {failed && <div role="alert" style={{ color: 'var(--danger, #ff7f8d)', fontSize: 12 }}>{pasteErrorLabel}</div>}
    </div>
  )
}
