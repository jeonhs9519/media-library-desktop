// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Toast, { useToast } from '../../src/renderer/src/components/Toast'

let root: Root
let notifications: ReturnType<typeof useToast>
function Harness({ library = false }: { library?: boolean }) {
  notifications = useToast()
  return React.createElement(Toast, {
    toast: notifications.toast,
    onClose: notifications.hideToast,
    className: library ? `library-center-toast is-${notifications.toast?.tone}` : undefined,
  })
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  document.body.innerHTML = '<div id="mount"></div>'
  root = createRoot(document.getElementById('mount')!)
})
afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('preserves viewer notification accessibility and dismisses after the visible and exit intervals', () => {
  act(() => root.render(React.createElement(Harness)))
  act(() => notifications.showToast('Thumbnail saved'))
  const message = document.querySelector('[role="status"]')!
  expect(message.className).toBe('viewer-toast')
  expect(message.getAttribute('aria-live')).toBe('polite')
  expect(message.textContent).toBe('Thumbnail saved')
  act(() => vi.advanceTimersByTime(2399))
  expect(message.classList.contains('is-closing')).toBe(false)
  act(() => vi.advanceTimersByTime(1))
  expect(message.classList.contains('is-closing')).toBe(true)
  act(() => vi.advanceTimersByTime(160))
  expect(document.querySelector('[role="status"]')).toBeNull()
})

it('keeps a replacement library error visible for its own full interval and cancels timers on unmount', () => {
  act(() => root.render(React.createElement(Harness, { library: true })))
  act(() => notifications.showToast('Item copied', 'success'))
  act(() => vi.advanceTimersByTime(2400))
  expect(document.querySelector('[role="status"]')!.classList.contains('is-closing')).toBe(true)
  act(() => notifications.showToast('Duplicate file', 'error'))
  const message = document.querySelector('[role="status"]')!
  expect(message.textContent).toBe('Duplicate file')
  expect(message.className).toBe('library-center-toast is-error')
  act(() => vi.advanceTimersByTime(160))
  expect(document.querySelector('[role="status"]')).toBe(message)
  act(() => vi.advanceTimersByTime(2239))
  expect(message.classList.contains('is-closing')).toBe(false)
  act(() => root.render(null))
  expect(vi.getTimerCount()).toBe(0)
})
