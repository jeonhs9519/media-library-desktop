import React, { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useI18n } from '../useI18n'

export default function PdfScrollPage({
  document,
  page,
  width,
  reportSize,
}: {
  document: PDFDocumentProxy
  page: number
  width: number
  reportSize: (page: number, width: number, height: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const { tr } = useI18n()
  useEffect(() => {
    let cancelled = false
    let task: RenderTask | undefined
    const target = canvas.current!
    setFailed(false)
    void (async () => {
      const pdfPage = await document.getPage(page + 1)
      if (cancelled) return
      const base = pdfPage.getViewport({ scale: 1 })
      reportSize(page, base.width, base.height)
      const viewport = pdfPage.getViewport({
        scale: width / base.width,
      })
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt((16 * 1024 * 1024) / (viewport.width * viewport.height)),
        32767 / Math.max(viewport.width, viewport.height)
      )
      target.width = Math.floor(viewport.width * dpr)
      target.height = Math.floor(viewport.height * dpr)
      target.style.width = `${viewport.width}px`
      target.style.height = `${viewport.height}px`
      task = pdfPage.render({ canvas: target, viewport, transform: [dpr, 0, 0, dpr, 0, 0] })
      await task.promise
    })().catch((error) => {
      if (!cancelled && error?.name !== 'RenderingCancelledException') {
        console.error(error)
        setFailed(true)
      }
    })
    return () => {
      cancelled = true
      task?.cancel()
      target.width = 0
      target.height = 0
    }
  }, [document, page, width, reportSize])
  return failed ? (
    <p role="alert">{tr('viewer.pdf.pageError')}</p>
  ) : (
    <canvas
      ref={canvas}
      aria-label={`Page ${page + 1}`}
      style={{ display: 'block', margin: 0, padding: 0 }}
    />
  )
}
