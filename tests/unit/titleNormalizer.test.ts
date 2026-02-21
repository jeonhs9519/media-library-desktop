import { describe, it, expect } from 'vitest'
import { normalizeTitle } from '../../src/main/utils/titleNormalizer'

describe('normalizeTitle', () => {
  it('removes file extension', () => {
    expect(normalizeTitle('My Book.pdf')).toBe('My Book')
  })

  it('removes content in square brackets', () => {
    expect(normalizeTitle('My Book [v2].pdf')).toBe('My Book')
  })

  it('removes content in curly braces', () => {
    expect(normalizeTitle('My Book {internal}.pdf')).toBe('My Book')
  })

  it('removes year in parentheses', () => {
    expect(normalizeTitle('My Movie (2020).mp4')).toBe('My Movie')
  })

  it('removes HD/quality info in parentheses', () => {
    expect(normalizeTitle('My Video (1080p).mp4')).toBe('My Video')
  })

  it('removes HD tag', () => {
    expect(normalizeTitle('My Video (HD).mp4')).toBe('My Video')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeTitle('My   Book.pdf')).toBe('My Book')
  })

  it('trims whitespace', () => {
    expect(normalizeTitle('  My Book  .pdf')).toBe('My Book')
  })

  it('handles no extension', () => {
    expect(normalizeTitle('My Book')).toBe('My Book')
  })
})
