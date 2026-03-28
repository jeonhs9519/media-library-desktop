import React from 'react'

type IconProps = {
  size?: number
}

const base: React.CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
}

export function SeekBackIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M6 7v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 7l-7 5 7 5V7z" fill="currentColor" />
    </svg>
  )
}

export function SeekForwardIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M18 7v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 7l7 5-7 5V7z" fill="currentColor" />
    </svg>
  )
}

export function PlayIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M8 6.5l10 5.5-10 5.5V6.5z" fill="currentColor" />
    </svg>
  )
}

export function PauseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <rect x="7" y="6" width="3.8" height="12" rx="1" fill="currentColor" />
      <rect x="13.2" y="6" width="3.8" height="12" rx="1" fill="currentColor" />
    </svg>
  )
}

export function LoopIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M7 8h8.5l-1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 16H8.5l1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 16v-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function LoopOffIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M7 8h8.5l-1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 16H8.5l1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 16v-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function FullscreenIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M8 4H4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CaretLeftIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M14.5 6.5L9 12l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ShareIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M14 5h5v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5l-8 8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ThumbnailIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <rect x="4" y="6" width="16" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 15l2.7-2.7a1 1 0 0 1 1.4 0L14 14.2l1.4-1.4a1 1 0 0 1 1.4 0L19 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="10" r="1.2" fill="currentColor" />
    </svg>
  )
}

export function FolderOpenIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M3.8 8.2h5.8l1.7 1.8h8.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 10.5h15l-1.9 7H6.4l-1.9-7z" fill="currentColor" opacity="0.95" />
    </svg>
  )
}

export function VolumeMuteIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M4 10h4l5-4v12l-5-4H4v-4z" fill="currentColor" />
      <path d="M17 10l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 10l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function VolumeLowIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M4 10h4l5-4v12l-5-4H4v-4z" fill="currentColor" />
      <path d="M16 9.5c1.5 1.5 1.5 3.5 0 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function VolumeHighIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={base} aria-hidden>
      <path d="M4 10h4l5-4v12l-5-4H4v-4z" fill="currentColor" />
      <path d="M16 8.2c2.4 2.2 2.4 5.4 0 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.5 6c3.6 3.4 3.6 8.6 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
