import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function VideoPlayerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const itemId = parseInt(id!)

  const [item, setItem] = useState<any>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState(false)
  const [errorDetail, setErrorDetail] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const load = async () => {
      const itemData = await window.api.items.getById(itemId)
      setItem(itemData)

      const fullPath = itemData.filePath + '/' + itemData.fileName +
        (itemData.fileExtension ? '.' + itemData.fileExtension : '')

      const url = await window.api.video.getLocalUrl(fullPath)
      setVideoUrl(url)
    }
    load().catch(console.error)
  }, [itemId])

  const handleLoadedMetadata = async () => {
    const video = videoRef.current
    if (!video) return

    if (item?.lastPositionSeconds) {
      video.currentTime = item.lastPositionSeconds
    }

    try {
      await video.play()
    } catch {
      // autoplay can be blocked by platform policy
    }
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video || !video.duration) return

    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const progress = video.currentTime / video.duration
      await window.api.items.update(itemId, {
        lastPositionSeconds: video.currentTime,
        progress,
      })
    }, 2000)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const video = videoRef.current
      if (!video) return

      if (e.key === ' ') {
        e.preventDefault()
        video.paused ? video.play() : video.pause()
      } else if (e.key === 'Home') {
        video.currentTime = 0
      } else if (e.key === 'Escape') {
        navigate(`/items/${itemId}`)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [itemId, navigate])

  const handleSetThumbnail = async () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
    await window.api.thumbnail.setFromImageData(itemId, base64)
    alert('Thumbnail updated!')
  }

  const handleExternalOpen = async () => {
    if (!item) return
    const fullPath = item.filePath + '/' + item.fileName +
      (item.fileExtension ? '.' + item.fileExtension : '')
    await window.api.file.openExternal(fullPath)
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>
      <div style={{
        background: '#16213e', padding: '8px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
        borderBottom: '1px solid #2a2a4a', flexShrink: 0,
      }}>
        <button className="btn-secondary" onClick={() => navigate(`/items/${itemId}`)}>← Back</button>
        <span style={{ fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item?.title}
        </span>
        <button className="btn-secondary" onClick={handleSetThumbnail}>📷 Set Thumbnail</button>
        <button className="btn-secondary" onClick={handleExternalOpen}>🔗 External Player</button>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onError={handleVideoError}
          />
        )}
        {error && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.45)',
          }}>
            <div style={{
              color: '#e0e0e0',
              textAlign: 'center',
              background: 'rgba(20, 20, 20, 0.8)',
              border: '1px solid #2a2a4a',
              borderRadius: 8,
              padding: 16,
              minWidth: 300,
            }}>
              <p>Video cannot be played in the built-in player.</p>
              {errorDetail && <p style={{ fontSize: 12, opacity: 0.8 }}>Reason: {errorDetail}</p>}
              <button className="btn-primary" onClick={handleExternalOpen} style={{ marginTop: 16 }}>
                Open in External Player
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
