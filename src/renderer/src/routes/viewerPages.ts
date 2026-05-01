export const loadPdfViewerPage = () => import('../pages/PdfViewerPage')
export const loadCbzViewerPage = () => import('../pages/CbzViewerPage')
export const loadVideoPlayerPage = () => import('../pages/VideoPlayerPage')

let preloadPromise: Promise<unknown> | null = null

export function preloadViewerPages() {
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      loadPdfViewerPage(),
      loadCbzViewerPage(),
      loadVideoPlayerPage(),
    ]).catch((error) => {
      preloadPromise = null
      throw error
    })
  }

  return preloadPromise
}
