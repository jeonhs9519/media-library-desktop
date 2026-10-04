import { describe, expect, it } from 'vitest'
import { getTooltipBoundary, getTooltipLeft } from '../../src/renderer/src/components/Tooltip/positioning'

describe('tooltip positioning', () => {
  const boundary = { left: 100, right: 500 }

  it('aligns with the trigger when the full tooltip fits', () => {
    expect(getTooltipLeft(180, 240, boundary)).toBe(180)
  })

  it('keeps a 240px tooltip flush with the right boundary when it would overflow', () => {
    expect(getTooltipLeft(420, 240, boundary)).toBe(260)
  })

  it('protects the left boundary when the trigger is outside it', () => {
    expect(getTooltipLeft(80, 240, boundary)).toBe(100)
  })

  it('preserves the width and right alignment when the container is narrower', () => {
    expect(getTooltipLeft(150, 240, { left: 100, right: 200 })).toBe(-40)
  })

  const metrics = { left: 50, right: 550, borderLeft: 2, borderRight: 4, paddingLeft: 16, paddingRight: 24, scrollbarWidth: 10 }

  it('respects asymmetric padding, borders and scrollbars for content-box', () => {
    expect(getTooltipBoundary(metrics, 'content-box')).toEqual({ left: 68, right: 512 })
  })

  it('includes padding but excludes borders and scrollbars for padding-box', () => {
    expect(getTooltipBoundary(metrics, 'padding-box')).toEqual({ left: 52, right: 536 })
  })

  it('uses the outer border edge for border-box', () => {
    expect(getTooltipBoundary(metrics, 'border-box')).toEqual({ left: 50, right: 550 })
  })
})
