import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { CbzPageCache } from './cbzPageCache'

export function useCbzPages(sessionId: string | null, currentPage: number, count: number, step: number) {
  const [images, setImages] = useState<Record<number, string>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const cache = useRef<CbzPageCache | null>(null)
  useEffect(() => {
    setImages({})
    setErrors({})
    if (!sessionId) return
    const instance = new CbzPageCache(async index => {
      const page = await api.cbz.getPage(sessionId, index)
      const bytes = new Uint8Array(page.data)
      const url = URL.createObjectURL(new Blob([bytes], { type: page.mimeType }))
      try {
        const image = new Image()
        image.src = url
        await image.decode()
        return { url, bytes: bytes.byteLength + image.naturalWidth * image.naturalHeight * 4 }
      } catch (error) {
        URL.revokeObjectURL(url)
        throw error
      }
    }, page => URL.revokeObjectURL(page.url), setImages, (index, error) => {
      console.error('Failed to load ZIP page', index, error)
      setErrors(previous => ({ ...previous, [index]: String(error) }))
    })
    cache.current = instance
    return () => {
      instance.dispose()
      cache.current = null
    }
  }, [sessionId])

  useEffect(() => {
    setErrors({})
    cache.current?.update(currentPage, count, step)
  }, [sessionId, currentPage, count, step])
  return { images, errors }
}
