// @vitest-environment jsdom
import React, { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route, useNavigate, useMatch } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import LibraryLayout from '../../src/renderer/src/routes/LibraryLayout'

const mounts = vi.hoisted(() => ({ count: 0, unmounts: 0 }))
vi.mock('../../src/renderer/src/pages/LibraryPage', () => ({ default: ({ active }: { active: boolean }) => {
  const id = useMatch('/items/:id')?.params.id
  useEffect(() => { mounts.count++; return () => { mounts.unmounts++ } }, [])
  return React.createElement('div', { id: 'library', 'data-active': String(active), 'data-item': id ?? '' })
} }))

it('retains the library DOM across viewers while exposing detail routes and blocking hidden interaction', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  document.body.innerHTML = '<div id="mount"></div>'
  const root = createRoot(document.getElementById('mount')!)
  let navigate!: ReturnType<typeof useNavigate>
  function Controls() { navigate = useNavigate(); return null }
  try {
    await act(async () => root.render(React.createElement(MemoryRouter, null,
      React.createElement(Controls), React.createElement(Routes, null,
        React.createElement(Route, { element: React.createElement(LibraryLayout) },
          React.createElement(Route, { path: '/', element: React.createElement(React.Fragment) }),
          React.createElement(Route, { path: '/items/:id', element: React.createElement(React.Fragment) }),
          React.createElement(Route, { path: '/view/cbz/:id', element: React.createElement('div', { id: 'viewer' }) }))))))
    const library = document.getElementById('library')!
    await act(async () => navigate('/items/12'))
    expect(library.getAttribute('data-item')).toBe('12')
    await act(async () => navigate('/view/cbz/12'))
    expect(library.parentElement!.getAttribute('aria-hidden')).toBe('true')
    expect(library.parentElement!.style.visibility).toBe('hidden')
    expect(library.parentElement!.hasAttribute('inert')).toBe(true)
    expect(library.getAttribute('data-active')).toBe('false')
    await act(async () => navigate('/'))
    expect(document.getElementById('library')).toBe(library)
    expect(library.parentElement!.getAttribute('aria-hidden')).toBe('false')
    expect(mounts).toEqual({ count: 1, unmounts: 0 })
  } finally {
    act(() => root.unmount())
    vi.unstubAllGlobals()
  }
})
