// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Tooltip from '../../src/renderer/src/components/Tooltip'

describe('tooltip container and interaction', () => {
  let root: Root
  let right: number
  let notifyResize: () => void

  beforeEach(() => {
    right = 700
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notifyResize = callback }
      observe() {}
      disconnect() {}
    })
    document.body.innerHTML = '<section class="tooltip-container" id="outer"><section class="tooltip-container" id="inner" data-tooltip-boundary="content-box" style="padding:16px;border:2px solid"><div id="mount"></div></section></section>'
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const left = this.id === 'inner' ? 400 : this.className === 'tooltip-anchor' ? 500 : 0
      const width = this.id === 'inner' ? right - 400 : this.className === 'tooltip-anchor' ? 20 : this.className === 'tooltip-content' ? 240 : 1000
      return { left, right: left + width, top: 0, bottom: 20, width, height: 20, x: left, y: 0, toJSON() {} }
    })
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getBoundingClientRect().width
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.offsetWidth - (this.id === 'inner' ? 4 : 0)
    })
    root = createRoot(document.getElementById('mount')!)
    act(() => root.render(React.createElement(Tooltip, { content: 'Language cannot be reset.', children: React.createElement('button', { type: 'button', 'aria-label': 'Language help' }, '?') })))
  })

  afterEach(() => {
    act(() => root.unmount())
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses the nearest container padding and dismisses on Escape without losing focus', () => {
    const button = document.querySelector('button')!
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!
    expect(tooltip.dataset.open).toBeUndefined()
    expect(tooltip.style.left).toBe('-58px')
    act(() => button.focus())
    expect(tooltip.style.width).toBe('240px')
    expect(tooltip.style.left).toBe('-58px')
    expect(tooltip.dataset.open).toBe('true')
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id)
    act(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(tooltip.dataset.open).toBeUndefined()
    expect(tooltip.style.left).toBe('-58px')
    expect(document.activeElement).toBe(button)
  })

  it('starts at the trigger left and recalculates when the container narrows', () => {
    right = 800
    const button = document.querySelector('button')!
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!
    act(() => window.dispatchEvent(new Event('resize')))
    expect(tooltip.style.left).toBe('0px')
    expect(tooltip.dataset.open).toBeUndefined()
    act(() => button.focus())
    expect(tooltip.style.left).toBe('0px')
    right = 700
    act(() => window.dispatchEvent(new Event('resize')))
    expect(tooltip.style.left).toBe('-58px')
    act(() => button.blur())
    expect(tooltip.dataset.open).toBeUndefined()
    expect(tooltip.style.left).toBe('-58px')
  })

  it('recalculates container width changes while hidden and keeps the position after hiding', () => {
    const button = document.querySelector('button')!
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!
    right = 620
    act(() => notifyResize())
    expect(tooltip.style.left).toBe('-138px')
    expect(tooltip.dataset.open).toBeUndefined()
    act(() => button.focus())
    expect(tooltip.style.left).toBe('-138px')
    act(() => button.blur())
    expect(tooltip.style.left).toBe('-138px')
    right = 800
    act(() => notifyResize())
    expect(tooltip.style.left).toBe('0px')
    expect(tooltip.dataset.open).toBeUndefined()
  })
})
