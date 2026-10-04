// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TagSearchInput from '../../src/renderer/src/components/TagSearchInput'

describe('tag search option limits and usage ordering', () => {
  let root: Root
  const options = Array.from({ length: 60 }, (_, index) => ({ id: index + 1, name: `Tag ${index + 1}`, count: index + 1 }))
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    HTMLElement.prototype.scrollIntoView = vi.fn()
    document.body.innerHTML = '<div id="mount"></div>'
    root = createRoot(document.getElementById('mount')!)
  })
  afterEach(() => {
    act(() => root.unmount())
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })
  function render(extra: { maxOptions?: number; countSort?: 'asc' | 'desc'; value?: string } = {}) {
    act(() => root.render(React.createElement(TagSearchInput, {
      value: '', options, onChange: vi.fn(), onCommit: vi.fn(), ...extra,
    })))
    act(() => document.querySelector<HTMLInputElement>('input')!.focus())
  }
  function names() {
    return Array.from(document.querySelectorAll('.tag-search-option-name'), (node) => node.textContent)
  }
  it('shows 20 by default while preserving supplied order', () => {
    render()
    expect(names()).toEqual(options.slice(0, 20).map((tag) => tag.name))
  })
  it('shows the 50 least used tags in ascending order', () => {
    render({ maxOptions: 50, countSort: 'asc' })
    expect(names()).toEqual(options.slice(0, 50).map((tag) => tag.name))
  })
  it.each(['asc', 'desc'] as const)('keeps the configured 50-result limit after entering a search query (%s)', (countSort) => {
    render({ maxOptions: 50, countSort })
    expect(names()).toHaveLength(50)
    render({ maxOptions: 50, countSort, value: 'Tag' })
    expect(names()).toHaveLength(50)
    const ordered = countSort === 'asc' ? options : [...options].reverse()
    expect(names()).toEqual(ordered.slice(0, 50).map((tag) => tag.name))
  })
  it('sorts before limiting and never mutates the caller options', () => {
    render({ maxOptions: 50, countSort: 'desc' })
    expect(names()).toEqual([...options].reverse().slice(0, 50).map((tag) => tag.name))
    expect(options[0].id).toBe(1)
    expect(options[59].id).toBe(60)
  })
  it('filters before limiting and uses the sorted candidate for Enter', () => {
    const onCommit = vi.fn()
    act(() => root.render(React.createElement(TagSearchInput, {
      value: 'Tag 5', options, maxOptions: 3, countSort: 'desc', onChange: vi.fn(), onCommit,
    })))
    const input = document.querySelector<HTMLInputElement>('input')!
    act(() => input.focus())
    expect(names()).toEqual(['Tag 59', 'Tag 58', 'Tag 57'])
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(onCommit).toHaveBeenCalledWith('Tag 59')
  })
})
