// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Modal from '../../src/renderer/src/components/Modal'

let root: Root
let opener: HTMLButtonElement
function Dialog({ open = false, autoFocus = false }: { open?: boolean; autoFocus?: boolean }) {
  return React.createElement(Modal, { open, onClose: () => {}, title: 'Test',
    children: React.createElement('input', { autoFocus, 'aria-label': 'Name' }) })
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  document.body.innerHTML = '<button id="opener">Open</button><div id="mount"></div>'
  opener = document.getElementById('opener') as HTMLButtonElement
  root = createRoot(document.getElementById('mount')!)
})
afterEach(() => { act(() => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals() })
it('restores the opener instead of an auto-focused dialog field without scrolling the page', () => {
  act(() => root.render(React.createElement(Dialog)))
  opener.focus()
  const focus = vi.spyOn(opener, 'focus')
  act(() => root.render(React.createElement(Dialog, { open: true, autoFocus: true })))
  act(() => vi.runAllTimers())
  expect(document.activeElement).toBe(document.querySelector('input'))
  act(() => root.render(React.createElement(Dialog)))
  expect(document.activeElement).toBe(opener)
  expect(focus).toHaveBeenLastCalledWith({ preventScroll: true })
})
it('remembers the opener even when it is disabled during an asynchronous operation', () => {
  act(() => root.render(React.createElement(Dialog)))
  opener.focus()
  opener.disabled = true
  opener.blur()
  act(() => root.render(React.createElement(Dialog, { open: true })))
  act(() => vi.runAllTimers())
  opener.disabled = false
  act(() => root.render(React.createElement(Dialog)))
  expect(document.activeElement).toBe(opener)
})
it('does not steal focus after a dialog closes immediately', () => {
  act(() => root.render(React.createElement(Dialog)))
  opener.focus()
  act(() => root.render(React.createElement(Dialog, { open: true })))
  act(() => root.render(React.createElement(Dialog)))
  const next = document.createElement('button')
  document.body.appendChild(next)
  next.focus()
  act(() => vi.runAllTimers())
  expect(document.activeElement).toBe(next)
})
