import { describe, expect, it } from 'vitest'
import { parseWindowState, restoreWindowBounds, type WindowState } from '../../src/main/services/windowState'

const primary = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }
const secondary = { id: 2, workArea: { x: -1920, y: 0, width: 1920, height: 1040 } }
const state: WindowState = { bounds: { x: -1800, y: 80, width: 1000, height: 700 }, displayId: 2, workArea: secondary.workArea, maximized: true }

describe('window state restore', () => {
  it('preserves negative monitor coordinates and normal bounds', () => {
    expect(restoreWindowBounds(state, [primary, secondary], primary)).toEqual(state.bounds)
    expect(parseWindowState(state)?.maximized).toBe(true)
  })
  it('centers on the primary display when the saved monitor is disconnected', () => {
    expect(restoreWindowBounds(state, [primary], primary)).toEqual({ x: 460, y: 170, width: 1000, height: 700 })
  })
  it('clamps oversized and offscreen bounds after a display change', () => {
    const small = { id: 2, workArea: { x: 0, y: 40, width: 640, height: 480 } }
    expect(restoreWindowBounds({ ...state, bounds: { x: -9000, y: 9000, width: 4000, height: 3000 } }, [small], small))
      .toEqual({ x: 0, y: 40, width: 640, height: 480 })
  })
  it('rejects corrupt state and defaults to a centered window', () => {
    for (const value of [null, {}, { ...state, bounds: { ...state.bounds, x: NaN } }, { ...state, maximized: 'yes' }]) {
      expect(parseWindowState(value)).toBeNull()
    }
    expect(restoreWindowBounds(null, [primary], primary)).toEqual({ x: 320, y: 120, width: 1280, height: 800 })
  })
})
