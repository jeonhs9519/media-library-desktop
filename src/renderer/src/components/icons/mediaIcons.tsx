import React from 'react'
import { IconProps, iconBaseStyle } from './base'

export function SeekBackIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M6 7v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 7l-7 5 7 5V7z" fill="currentColor" />
    </svg>
  )
}

export function SeekForwardIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M18 7v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 7l7 5-7 5V7z" fill="currentColor" />
    </svg>
  )
}

export function PlayIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M8 6.5l10 5.5-10 5.5V6.5z" fill="currentColor" />
    </svg>
  )
}

export function PauseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <rect x="7" y="6" width="3.8" height="12" rx="1" fill="currentColor" />
      <rect x="13.2" y="6" width="3.8" height="12" rx="1" fill="currentColor" />
    </svg>
  )
}

export function LoopIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M7 8h8.5l-1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 16H8.5l1.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 16v-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function LoopOffIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M8 4H4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16v4h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function VolumeMuteIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M4 10h4l5-4v12l-5-4H4v-4z" fill="currentColor" />
      <path d="M17 10l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 10l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function VolumeLowIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M4 10h4l5-4v12l-5-4H4v-4z" fill="currentColor" />
      <path d="M16 9.5c1.5 1.5 1.5 3.5 0 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function VolumeHighIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={iconBaseStyle} aria-hidden>
      <path d="M4 10h4l5-4v12l-5-4H4v-4z" fill="currentColor" />
      <path d="M16 8.2c2.4 2.2 2.4 5.4 0 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.5 6c3.6 3.4 3.6 8.6 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
