import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useI18n } from '../useI18n'
import {
  CaretLeftIcon,
  CloseXIcon,
  FolderOpenIcon,
  FullscreenIcon,
  LoopIcon,
  LoopOffIcon,
  MenuIcon,
  PauseIcon,
  PlayIcon,
  ShareIcon,
  SeekBackIcon,
  SeekForwardIcon,
  ThumbnailIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from '../components/icons'
import ContextMenu, { ContextMenuEntry } from '../components/ContextMenu'
import Toast, { useToast } from '../components/Toast'
import { getNextPlaylistViewerPath } from '../playlistAutoAdvance'
import { useViewerPlaylist } from '../useViewerPlaylist'
import PlaylistPanel from '../components/Library/PlaylistPanel'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VideoPlayerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const itemId = parseInt(id || '0', 10)
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || `/items/${itemId}`
  const { tr } = useI18n()

  const [item, setItem] = useState<any>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState(false)
  const [errorDetail, setErrorDetail] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isLooping, setIsLooping] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isControlsVisible, setIsControlsVisible] = useState(false)
  const [hoverRatio, setHoverRatio] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const thumbnailToast = useToast()
  const viewerPlaylist = useViewerPlaylist(itemId, navigate, returnTo)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const volumeSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const controlsHideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const playStartHideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const videoClickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isLoopingRef = useRef(false)
  const hoverRatioRef = useRef<number | null>(null)
  const didRunInitialOverlayAutoHideRef = useRef(false)

  const debounceSaveVolume = (vol: number) => {
    clearTimeout(volumeSaveTimer.current)
    volumeSaveTimer.current = setTimeout(() => {
      api.settings.set('video.volume', String(vol))
    }, 1000)
  }

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen()
      return
    }
    document.exitFullscreen()
  }

  const seekBy = (deltaSeconds: number) => {
    const video = videoRef.current
    if (!video) return
    const current = Number.isFinite(video.currentTime) ? video.currentTime : 0
    const finiteDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null
    const safeMax = finiteDuration !== null ? Math.max(0, finiteDuration - 0.05) : null
    let next = current + deltaSeconds
    if (safeMax !== null) next = Math.min(safeMax, next)
    video.currentTime = Math.max(0, next)
  }

  useEffect(() => {
    const load = async () => {
      const itemData = await api.items.getById(itemId)
      setItem(itemData)

      const savedVolume = await api.settings.get('video.volume')
      if (savedVolume !== null) {
        const parsed = parseFloat(savedVolume)
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          setVolume(parsed)
        }
      }

      const fullPath =
        itemData.filePath + '/' + itemData.fileName +
        (itemData.fileExtension ? '.' + itemData.fileExtension : '')
      const url = await api.video.getLocalUrl(fullPath)
      setVideoUrl(url)
    }
    load().catch(console.error)
  }, [itemId])

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (contextMenu) return
      const video = videoRef.current
      if (!video) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          handleTogglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekBy(-5)
          break
        case 'ArrowRight':
          e.preventDefault()
          seekBy(5)
          break
        case 'ArrowUp': {
          e.preventDefault()
          const up = Math.min(1, video.volume + 0.05)
          video.volume = up
          setVolume(up)
          debounceSaveVolume(up)
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          const down = Math.max(0, video.volume - 0.05)
          video.volume = down
          setVolume(down)
          debounceSaveVolume(down)
          break
        }
        case 'm':
        case 'M':
          video.volume = 0
          setVolume(0)
          debounceSaveVolume(0)
          break
        case 'f':
        case 'F':
        case 'F11':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'r':
        case 'R':
          handleToggleLoop()
          break
        case 'PageUp':
          e.preventDefault()
          viewerPlaylist.goPrevious()
          break
        case 'PageDown':
          e.preventDefault()
          viewerPlaylist.goNext()
          break
        case 'l':
        case 'L':
          e.preventDefault()
          viewerPlaylist.toggleVisible()
          break
        case 'Escape':
        case 'Backspace':
          navigate(returnTo)
          break
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [itemId, navigate, contextMenu, viewerPlaylist, returnTo])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  useEffect(() => {
    return () => {
      clearTimeout(controlsHideTimer.current)
      clearTimeout(playStartHideTimer.current)
      clearTimeout(videoClickTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      clearTimeout(controlsHideTimer.current)
      setIsControlsVisible(true)
    }
  }, [isPlaying])

  const showControls = () => {
    clearTimeout(controlsHideTimer.current)
    setIsControlsVisible(true)
  }

  const hideControlsWithDelay = () => {
    clearTimeout(controlsHideTimer.current)
    if (!isPlaying) {
      setIsControlsVisible(true)
      return
    }
    controlsHideTimer.current = setTimeout(() => {
      setIsControlsVisible(false)
    }, 3000)
  }

  const scheduleAutoHideAfterPlay = () => {
    if (didRunInitialOverlayAutoHideRef.current) return
    didRunInitialOverlayAutoHideRef.current = true

    clearTimeout(playStartHideTimer.current)
    playStartHideTimer.current = setTimeout(async () => {
      const video = videoRef.current
      if (!video || video.paused) return

      try {
        const isCursorInsideWindow = await api.app.isCursorInsideWindow()
        if (!isCursorInsideWindow) {
          setIsControlsVisible(false)
        }
      } catch {
        // Keep current overlay state if cursor query fails.
      }
    }, 3000)
  }

  useEffect(() => {
    didRunInitialOverlayAutoHideRef.current = false
    if (!videoUrl || error) return
    setIsControlsVisible(true)
  }, [videoUrl, error])

  const handleLoadedMetadata = async () => {
    const video = videoRef.current
    if (!video || !item) return

    setDuration(video.duration)
    video.volume = volume

    if (!item.totalContent && video.duration > 0) {
      await api.items.update(itemId, { totalContent: video.duration })
    }

    const total = video.duration || item.totalContent || 0
    if (item.lastPositionSeconds && item.lastPositionSeconds < total - 5) {
      video.currentTime = item.lastPositionSeconds
    }

    try {
      await video.play()
    } catch {
      // autoplay may be blocked by platform policy
    }
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video || !video.duration) return

    setCurrentTime(video.currentTime)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const progress = video.currentTime / video.duration
      await api.items.update(itemId, {
        lastPositionSeconds: video.currentTime,
        progress,
      })
    }, 2000)
  }

  const handleEnded = async () => {
    const video = videoRef.current
    if (isLoopingRef.current) {
      await api.items.update(itemId, { watched: 1 })
      if (video) {
        video.currentTime = 0
        video.play()
      }
      return
    }

    await api.items.update(itemId, {
      watched: 1,
      progress: 1,
      lastPositionSeconds: video?.duration ?? 0,
    })

    const nextPath = await getNextPlaylistViewerPath(itemId)
    if (nextPath) navigate(nextPath, { state: { returnTo } })
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
    if (videoRef.current) videoRef.current.volume = vol
    debounceSaveVolume(vol)
  }

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    hoverRatioRef.current = ratio
    setHoverRatio(ratio)
  }

  const handleProgressMouseLeave = () => {
    hoverRatioRef.current = null
    setHoverRatio(null)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    if (videoRef.current && duration > 0) {
      const safeMax = Math.max(0, duration - 0.05)
      videoRef.current.currentTime = Math.min(safeMax, ratio * duration)
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleProgressKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video || duration <= 0) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      seekBy(-5)
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      seekBy(5)
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      video.currentTime = 0
      setCurrentTime(0)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      const safeMax = Math.max(0, duration - 0.05)
      video.currentTime = safeMax
      setCurrentTime(safeMax)
    }
  }

  const handleToggleLoop = () => {
    const next = !isLoopingRef.current
    isLoopingRef.current = next
    setIsLooping(next)
  }

  const handleTogglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }

  const handleVideoSingleClick = () => {
    clearTimeout(videoClickTimer.current)
    videoClickTimer.current = setTimeout(() => {
      handleTogglePlay()
    }, 220)
  }

  const handleVideoDoubleClick = () => {
    clearTimeout(videoClickTimer.current)
    toggleFullscreen()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleSetThumbnail = async () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
    await api.thumbnail.setFromImageData(itemId, base64)
    thumbnailToast.showToast(tr('viewer.thumbnailUpdated'))
  }

  const handleExternalOpen = async () => {
    if (!item) return
    const fullPath =
      item.filePath + '/' + item.fileName +
      (item.fileExtension ? '.' + item.fileExtension : '')
    await api.file.openExternal(fullPath)
  }

  const handleShowInFolder = async () => {
    if (!item) return
    const fullPath =
      item.filePath + '/' + item.fileName +
      (item.fileExtension ? '.' + item.fileExtension : '')
    await api.file.showInFolder(fullPath)
  }

  const handleVideoError = () => {
    const code = videoRef.current?.error?.code
    const detail = ({
      1: 'MEDIA_ERR_ABORTED',
      2: 'MEDIA_ERR_NETWORK',
      3: 'MEDIA_ERR_DECODE',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
    } as Record<number, string>)[code || 0] || 'UNKNOWN_ERROR'

    setErrorDetail(detail)
    setError(true)
  }

  const playRatio = duration > 0 ? currentTime / duration : 0
  const displayRatio = hoverRatio !== null ? hoverRatio : playRatio
  const volumeIcon = volume === 0
    ? <VolumeMuteIcon size={28} />
    : volume < 0.5
      ? <VolumeLowIcon size={28} />
      : <VolumeHighIcon size={28} />
  const volumePercent = Math.round(volume * 100)
  const controlsTabIndex = videoUrl && !error && isControlsVisible ? 0 : -1
  const handleExitViewer = () => navigate(returnTo)
  const contextMenuItems: ContextMenuEntry[] = [
    {
      key: 'play-toggle',
      label: isPlaying ? tr('viewer.video.pause') : tr('viewer.video.play'),
      icon: isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />,
      shortcut: tr('viewer.video.shortcut.space'),
      onSelect: () => {
        handleTogglePlay()
      },
    },
    {
      key: 'loop',
      label: tr('viewer.video.loopPlay'),
      icon: isLooping ? <LoopIcon size={16} /> : <LoopOffIcon size={16} />,
      shortcut: tr('viewer.video.shortcut.loop'),
      tone: isLooping ? 'accent' : 'default',
      checked: isLooping,
      onSelect: handleToggleLoop,
    },
    { key: 'sep-playback', type: 'separator' },
    {
      key: 'thumbnail',
      label: tr('viewer.setThumbnail'),
      icon: <ThumbnailIcon size={16} />,
      onSelect: handleSetThumbnail,
    },
    {
      key: 'fullscreen',
      label: tr('viewer.video.fullscreen'),
      icon: <FullscreenIcon size={16} />,
      shortcut: tr('viewer.video.shortcut.fullscreen'),
      onSelect: toggleFullscreen,
    },
    { key: 'sep-2', type: 'separator' },
    {
      key: 'playlist-toggle',
      label: tr('playlist.viewerToggle'),
      icon: <MenuIcon size={16} />,
      shortcut: 'L',
      disabled: !viewerPlaylist.available,
      tone: viewerPlaylist.visible ? 'accent' : 'default',
      checked: viewerPlaylist.visible,
      onSelect: viewerPlaylist.toggleVisible,
    },
    {
      key: 'playlist-prev',
      label: tr('playlist.previousItem'),
      shortcut: 'PgUp',
      disabled: !viewerPlaylist.canGoPrevious,
      onSelect: viewerPlaylist.goPrevious,
    },
    {
      key: 'playlist-next',
      label: tr('playlist.nextItem'),
      shortcut: 'PgDown',
      disabled: !viewerPlaylist.canGoNext,
      onSelect: viewerPlaylist.goNext,
    },
    { key: 'sep-playlist', type: 'separator' },
    {
      key: 'show-in-folder',
      label: tr('viewer.video.showInFolder'),
      icon: <FolderOpenIcon size={16} />,
      onSelect: handleShowInFolder,
    },
    {
      key: 'exit-viewer',
      label: tr('viewer.cbz.exitViewer'),
      icon: <CloseXIcon size={16} />,
      shortcut: 'Esc / Backspace',
      onSelect: handleExitViewer,
    },
  ]

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', minHeight: 0, overflow: 'hidden', background: '#000' }}
      onContextMenu={handleContextMenu}
    >
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={showControls}
          onMouseMove={showControls}
          onMouseLeave={hideControlsWithDelay}
        >
          <Toast toast={thumbnailToast.toast} onClose={thumbnailToast.hideToast} />
          {videoUrl && !error && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                zIndex: 21,
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                maxWidth: '100%',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.9) 28%, rgba(0,0,0,0.74) 58%, rgba(0,0,0,0.44) 78%, rgba(0,0,0,0.18) 92%, rgba(0,0,0,0) 100%)',
                opacity: isControlsVisible ? 1 : 0,
                transform: isControlsVisible ? 'translateY(0)' : 'translateY(-6px)',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                pointerEvents: isControlsVisible ? 'auto' : 'none',
              }}
            >
              <div
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  padding: '0 12px',
                  paddingRight: 150,
                  WebkitAppRegion: 'drag',
                } as any}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 0.2 }}>
                  {tr('app.title')}
                </span>
              </div>

              <div
                style={{
                  padding: '16px 12px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <button
                  className="video-control-button"
                  tabIndex={controlsTabIndex}
                  onClick={() => navigate(returnTo)}
                  title={tr('common.back')}
                  aria-label={tr('common.back')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 2px',
                    color: '#fff',
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <CaretLeftIcon size={24} />
                </button>
                <span style={{ fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item?.title}
                </span>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <button
                    className="video-control-button"
                    tabIndex={controlsTabIndex}
                    onClick={handleExternalOpen}
                    title={tr('viewer.video.externalPlayer')}
                    aria-label={tr('viewer.video.externalPlayer')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 2px',
                      color: '#fff',
                      background: 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <ShareIcon size={24} />
                  </button>
                  <button
                    className="video-control-button"
                    tabIndex={controlsTabIndex}
                    onClick={handleSetThumbnail}
                    title={tr('viewer.setThumbnail')}
                    aria-label={tr('viewer.setThumbnail')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 2px',
                      color: '#fff',
                      background: 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <ThumbnailIcon size={24} />
                  </button>
                  <button
                    className="video-control-button"
                    tabIndex={controlsTabIndex}
                    onClick={viewerPlaylist.toggleVisible}
                    title={tr('playlist.viewerToggle')}
                    aria-label={tr('playlist.viewerToggle')}
                    disabled={!viewerPlaylist.available}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 2px',
                      color: viewerPlaylist.visible ? '#4a9eff' : '#d2d8e2',
                      background: viewerPlaylist.visible ? 'rgba(74, 158, 255, 0.14)' : 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                      cursor: viewerPlaylist.available ? 'pointer' : 'default',
                    }}
                  >
                    <MenuIcon size={24} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center center' }}
              onClick={handleVideoSingleClick}
              onDoubleClick={handleVideoDoubleClick}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => {
                setIsPlaying(true)
                showControls()
                scheduleAutoHideAfterPlay()
              }}
              onPause={() => {
                setIsPlaying(false)
                showControls()
              }}
              onEnded={handleEnded}
              onError={handleVideoError}
            />
          )}

          {error && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--overlay)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div
                style={{
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                  background: 'var(--surface-glass)',
                  border: '1px solid var(--border)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 8,
                  padding: 16,
                  minWidth: 300,
                }}
              >
                <p>{tr('viewer.video.cannotPlayBuiltIn')}</p>
                {errorDetail && <p style={{ fontSize: 12, opacity: 0.8 }}>{tr('viewer.video.reason')}: {errorDetail}</p>}
                <button className="btn-primary" onClick={handleExternalOpen} style={{ marginTop: 16 }}>
                  {tr('viewer.video.openExternalPlayer')}
                </button>
              </div>
            </div>
          )}

          {videoUrl && !error && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 20,
                padding: '16px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                width: '100%',
                maxWidth: '100%',
                background: 'linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.72) 46%, rgba(0,0,0,0.36) 76%, rgba(0,0,0,0.12) 92%, rgba(0,0,0,0) 100%)',
                opacity: isControlsVisible ? 1 : 0,
                transform: isControlsVisible ? 'translateY(0)' : 'translateY(6px)',
                transition: 'opacity 0.2s ease, transform 0.2s ease',
                pointerEvents: isControlsVisible ? 'auto' : 'none',
              }}
            >
            <div
              className="video-progress-track"
              role="slider"
              aria-label={tr('viewer.video.seekForward5s')}
              aria-valuemin={0}
              aria-valuemax={Math.max(0, Math.floor(duration))}
              aria-valuenow={Math.max(0, Math.floor(currentTime))}
              tabIndex={controlsTabIndex}
              style={{
                height: 6,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 3,
                cursor: 'pointer',
                position: 'relative',
              }}
              onMouseMove={handleProgressMouseMove}
              onMouseLeave={handleProgressMouseLeave}
              onClick={handleProgressClick}
              onKeyDown={handleProgressKeyDown}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${displayRatio * 100}%`,
                  background: hoverRatio !== null ? 'rgba(255,255,255,0.7)' : 'var(--accent, #4a9eff)',
                  borderRadius: 3,
                  transition: hoverRatio !== null ? 'none' : 'width 0.1s',
                }}
              />
              {hoverRatio !== null && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 14,
                    left: `${hoverRatio * 100}%`,
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.8)',
                    color: '#fff',
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 3,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatTime(hoverRatio * duration)}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 6 }}>
              <button
                className="video-control-button"
                tabIndex={controlsTabIndex}
                onClick={() => seekBy(-5)}
                title={tr('viewer.video.seekBack5s')}
                style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
              >
                <SeekBackIcon size={24} />
              </button>
              <button
                className="video-control-button"
                tabIndex={controlsTabIndex}
                onClick={handleTogglePlay}
                title={isPlaying ? tr('viewer.video.pause') : tr('viewer.video.play')}
                style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
              >
                {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
              </button>
              <button
                className="video-control-button"
                tabIndex={controlsTabIndex}
                onClick={() => seekBy(5)}
                title={tr('viewer.video.seekForward5s')}
                style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
              >
                <SeekForwardIcon size={24} />
              </button>

              <span style={{ color: '#ccc', fontSize: 12, userSelect: 'none', minWidth: 88, letterSpacing: 0.3 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div style={{ flex: '1 1 24px', minWidth: 12 }} />

              <button
                className="video-control-button"
                tabIndex={controlsTabIndex}
                onClick={handleToggleLoop}
                title={tr('viewer.video.loopPlay')}
                style={{
                  color: isLooping ? '#4a9eff' : '#d2d8e2',
                  background: isLooping ? 'rgba(74, 158, 255, 0.14)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--video-control-radius)',
                  cursor: 'pointer',
                  fontSize: 13,
                  padding: '2px 6px',
                  lineHeight: 1.3,
                }}
              >
                {isLooping ? <LoopIcon size={24} /> : <LoopOffIcon size={24} />}
              </button>

              <div className="video-volume-group" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#fff', fontSize: 12, userSelect: 'none', minWidth: 36 }}>{volumeIcon}</span>
                <input
                  className="video-volume-slider"
                  tabIndex={controlsTabIndex}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={handleVolumeChange}
                  style={{
                    width: 'clamp(58px, 16vw, 96px)',
                    cursor: 'pointer',
                    appearance: 'none',
                    height: 4,
                    padding: 0,
                    border: 'none',
                    borderRadius: 999,
                    background: `linear-gradient(to right, #4a9eff 0%, #4a9eff ${volumePercent}%, rgba(255,255,255,0.28) ${volumePercent}%, rgba(255,255,255,0.28) 100%)`,
                  }}
                  title={`${volumePercent}%`}
                />
              </div>

              <button
                className="video-control-button"
                tabIndex={controlsTabIndex}
                onClick={toggleFullscreen}
                title={tr('viewer.video.fullscreen')}
                style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
              >
                <FullscreenIcon size={24} />
              </button>
            </div>
            </div>
          )}

          {viewerPlaylist.visible && isControlsVisible && (
            <div className="viewer-playlist-panel-wrap">
              <PlaylistPanel
                items={viewerPlaylist.items}
                thumbnails={viewerPlaylist.thumbnails}
                collapsed={false}
                position="right"
                onToggleCollapsed={viewerPlaylist.toggleVisible}
                onDropItem={() => undefined}
                onRemoveItem={viewerPlaylist.removeItem}
                onClear={viewerPlaylist.clear}
                onReorderItems={viewerPlaylist.reorderItems}
                viewerReturnTo={returnTo}
                showCollapseButton={false}
                viewerMode
                currentItemId={itemId}
                tr={tr}
              />
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          id="video-context-menu"
          position={contextMenu}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
          minWidth={280}
        />
      )}
    </div>
  )
}
