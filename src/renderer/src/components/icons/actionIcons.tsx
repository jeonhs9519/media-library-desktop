import React from 'react'
import { IconProps, iconBaseStyle } from './base'

export function CaretLeftIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M14.5 6.5L9 12l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CaretRightIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M9.5 6.5L15 12l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

export function SortAscendingIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M7 18V6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M4.6 8.4L7 6l2.4 2.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M13 12h4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M13 16h3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

export function SortDescendingIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M7 6v12" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M4.6 15.6L7 18l2.4-2.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8h6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M13 12h4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M13 16h3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

export function RefreshIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M18.4 8.2A7.2 7.2 0 0 0 6.2 6.8L4.5 8.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.3 4.5v4.2h4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.6 15.8a7.2 7.2 0 0 0 12.2 1.4l1.7-1.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.7 19.5v-4.2h-4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <circle cx="10.8" cy="10.8" r="5.8" stroke="currentColor" strokeWidth="1.9" />
      <path d="M15.1 15.1l4.1 4.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

export function SettingsGearIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.2 13.1a7.7 7.7 0 0 0 0-2.2l2-1.4-2-3.4-2.4 1a8.2 8.2 0 0 0-1.9-1.1L14.6 3h-5.2L9 6a8.2 8.2 0 0 0-1.9 1.1l-2.4-1-2 3.4 2 1.4a7.7 7.7 0 0 0 0 2.2l-2 1.4 2 3.4 2.4-1a8.2 8.2 0 0 0 1.9 1.1l.4 3h5.2l.4-3a8.2 8.2 0 0 0 1.9-1.1l2.4 1 2-3.4-2.1-1.4z" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CodeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M9.2 7.2L4.8 12l4.4 4.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.8 7.2l4.4 4.8-4.4 4.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2 5.2l-2.4 13.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

export function MinusSquareIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  )
}

export function PlusSquareIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M6 12h12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M12 6v12" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
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

export function MenuIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M5 7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
