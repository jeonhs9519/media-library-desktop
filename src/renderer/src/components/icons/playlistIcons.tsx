import { IconProps, iconBaseStyle } from './base'

export function PlaylistCreateIcon({ size = 16 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconBaseStyle} aria-hidden>
    <path d="M4 12h16M12 4v16" strokeWidth="2.2" />
  </svg>
}

export function PlaylistRenameIcon({ size = 16 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconBaseStyle} aria-hidden>
    <rect x="3" y="3" width="16" height="16" rx="1" />
    <path d="m12 17 7-7 3 3-7 7-4 1 1-4Z" fill="var(--bg-secondary)" />
    <path d="m17.5 11.5 3 3" />
  </svg>
}

export function PlaylistResetIcon({ size = 16 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={iconBaseStyle} aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="1" strokeDasharray="3 3" />
  </svg>
}
