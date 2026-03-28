import React from 'react'
import { IconProps, iconBaseStyle } from './base'

export function CaretLeftIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M14.5 6.5L9 12l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronLeftIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M15 6.5L9.5 12 15 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M9 6.5L14.5 12 9 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CloseXIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M6.8 6.8l10.4 10.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.2 6.8L6.8 17.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ShareIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M14 5h5v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5l-8 8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ThumbnailIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 15l2.7-2.7a1 1 0 0 1 1.4 0L14 14.2l1.4-1.4a1 1 0 0 1 1.4 0L19 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function FolderOpenIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M3.8 8.2h5.8l1.7 1.8h8.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 10.5h15l-1.9 7H6.4l-1.9-7z" fill="currentColor" opacity="0.95" />
    </svg>
  )
}

export function SinglePageModeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M7.2 3.8h7.2l4.8 4v12.4H7.2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14.4 3.8v4h4.8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <text x="12.1" y="16.3" textAnchor="middle" fontSize="7.4" fontWeight="700" fill="currentColor" fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI">1</text>
    </svg>
  )
}

export function DoublePageLtrModeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      {/* Left page */}
      <path d="M2.5 4h9v16h-9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Right page with fold at top-right */}
      <path d="M12.5 4h5.5l3.5 3.5v12.5H12.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 4v3.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Arrow crossing both pages LTR */}
      <path d="M4.5 12h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.8 10l2.7 2-2.7 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DoublePageRtlModeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      {/* Left page */}
      <path d="M2.5 4h9v16h-9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Right page with fold at top-right */}
      <path d="M12.5 4h5.5l3.5 3.5v12.5H12.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 4v3.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Arrow crossing both pages RTL */}
      <path d="M4.5 12h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.2 10l-2.7 2 2.7 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
