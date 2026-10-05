// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useViewerIdle } from '../../src/renderer/src/useViewerIdle'

let root: Root
function Viewer({ blocked = false, keyboardMode = 'all' }: { blocked?: boolean; keyboardMode?: 'all' | 'toolbar' }) {
  const idle = useViewerIdle(blocked, keyboardMode)
  return React.createElement('div', { 'data-visible': String(idle.visible) })
}
const visible = () => document.querySelector('[data-visible]')!.getAttribute('data-visible')
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  document.body.innerHTML = '<div id="mount"></div>'
  root = createRoot(document.getElementById('mount')!)
  act(() => root.render(React.createElement(Viewer)))
})
afterEach(() => {
  act(() => root.unmount())
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})
it('hides at 2.4 seconds even when the mouse remains inside, and restarts after movement', () => {
  act(() => vi.advanceTimersByTime(2399))
  expect(visible()).toBe('true')
  act(() => vi.advanceTimersByTime(1))
  expect(visible()).toBe('false')
  act(() => document.dispatchEvent(new MouseEvent('mousemove')))
  expect(visible()).toBe('true')
  act(() => vi.advanceTimersByTime(2000))
  act(() => document.dispatchEvent(new MouseEvent('mousemove')))
  act(() => vi.advanceTimersByTime(2399))
  expect(visible()).toBe('true')
  act(() => vi.advanceTimersByTime(1))
  expect(visible()).toBe('false')
})
it('restores controls for keyboard interaction and holds them while a menu is open', () => {
  act(() => vi.advanceTimersByTime(2400))
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' })))
  expect(visible()).toBe('true')
  act(() => root.render(React.createElement(Viewer, { blocked: true })))
  act(() => vi.advanceTimersByTime(10000))
  expect(visible()).toBe('true')
  act(() => root.render(React.createElement(Viewer, { blocked: false })))
  act(() => vi.advanceTimersByTime(2400))
  expect(visible()).toBe('false')
})

it('keeps book controls hidden during page, scroll, zoom and playlist keyboard actions', () => {
  act(() => root.render(React.createElement(Viewer, { keyboardMode: 'toolbar' })))
  act(() => vi.advanceTimersByTime(2400))
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', ' ', 'z', '1', '2', '+', '-', '0', 'l', 'PageUp', 'PageDown', 'F10']) {
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key })))
    expect(visible()).toBe('false')
  }
})

it('shows book controls for Tab, Shift+Tab, ContextMenu, Shift+F10 and mouse actions', () => {
  act(() => root.render(React.createElement(Viewer, { keyboardMode: 'toolbar' })))
  for (const event of [
    new KeyboardEvent('keydown', { key: 'Tab' }),
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }),
    new KeyboardEvent('keydown', { key: 'ContextMenu' }),
    new KeyboardEvent('keydown', { key: 'F10', shiftKey: true }),
    new MouseEvent('mousemove'),
    new MouseEvent('pointerdown'),
  ]) {
    act(() => vi.advanceTimersByTime(2400))
    expect(visible()).toBe('false')
    act(() => document.dispatchEvent(event))
    expect(visible()).toBe('true')
  }
})

it('does not extend the book hide timer for navigation keys and retains video keyboard behavior', () => {
  act(() => root.render(React.createElement(Viewer, { keyboardMode: 'toolbar' })))
  act(() => vi.advanceTimersByTime(2000))
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })))
  act(() => vi.advanceTimersByTime(400))
  expect(visible()).toBe('false')
  act(() => root.render(React.createElement(Viewer)))
  act(() => vi.advanceTimersByTime(2400))
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })))
  expect(visible()).toBe('true')
})
