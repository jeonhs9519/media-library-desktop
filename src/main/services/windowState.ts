export type WindowBounds = { x: number; y: number; width: number; height: number }
export type WindowDisplay = { id: number; workArea: WindowBounds }
export type WindowState = { bounds: WindowBounds; displayId: number; workArea: WindowBounds; maximized: boolean }

function validBounds(value: unknown): value is WindowBounds {
  const b = value as WindowBounds | undefined
  return !!b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width > 0 && b.height > 0
}

export function parseWindowState(value: unknown): WindowState | null {
  const state = value as WindowState | undefined
  if (!state || !validBounds(state.bounds) || !validBounds(state.workArea)
    || !Number.isFinite(state.displayId) || typeof state.maximized !== 'boolean') return null
  return state
}

export function restoreWindowBounds(state: WindowState | null, displays: WindowDisplay[], primary: WindowDisplay): WindowBounds {
  const display = displays.find(d => d.id === state?.displayId) || primary
  const area = display.workArea
  const width = Math.min(area.width, Math.max(800, state?.bounds.width || 1280))
  const height = Math.min(area.height, Math.max(600, state?.bounds.height || 800))
  const sameDisplay = state && display.id === state.displayId
  const x = sameDisplay ? area.x + state.bounds.x - state.workArea.x : area.x + (area.width - width) / 2
  const y = sameDisplay ? area.y + state.bounds.y - state.workArea.y : area.y + (area.height - height) / 2
  return {
    x: Math.round(Math.max(area.x, Math.min(area.x + area.width - width, x))),
    y: Math.round(Math.max(area.y, Math.min(area.y + area.height - height, y))),
    width: Math.round(width), height: Math.round(height),
  }
}
