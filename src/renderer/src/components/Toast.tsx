import React, { useCallback, useEffect, useState } from 'react'

type ToastState = {
  id: number
  message: string
}

interface ToastProps {
  toast: ToastState | null
  onClose: () => void
  durationMs?: number
  exitDurationMs?: number
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string) => {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message }))
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  return { toast, showToast, hideToast }
}

export default function Toast({ toast, onClose, durationMs = 2400, exitDurationMs = 160 }: ToastProps) {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (!toast) return

    setIsClosing(false)
    const closeTimeoutId = window.setTimeout(() => {
      setIsClosing(true)
    }, durationMs)
    return () => window.clearTimeout(closeTimeoutId)
  }, [durationMs, toast])

  useEffect(() => {
    if (!toast || !isClosing) return

    const removeTimeoutId = window.setTimeout(onClose, exitDurationMs)
    return () => window.clearTimeout(removeTimeoutId)
  }, [exitDurationMs, isClosing, onClose, toast])

  if (!toast) return null

  return (
    <div className={`viewer-toast${isClosing ? ' is-closing' : ''}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  )
}
