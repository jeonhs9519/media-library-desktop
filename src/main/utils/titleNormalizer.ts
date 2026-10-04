export function normalizeTitle(fileName: string): string {
  let title = fileName.replace(/\.[^/.]+$/, '')
  title = title.replace(/\[.*?\]/g, '')
  title = title.replace(/\{.*?\}/g, '')
  title = title.replace(/\((?:19|20)\d{2}\)/gi, '')
  title = title.replace(/\((?:HD|SD|4K|2K|1080p?|720p?|480p?|360p?|BluRay|BDRip|DVDRip|WEBRip|WEB-DL|HDTV|x264|x265|H\.264|H\.265|AAC|MP3|HEVC|AVC)[^)]*\)/gi, '')
  title = title.replace(/\s+/g, ' ').trim()
  return title || fileName
}

export function getDefaultContentType(fileType: string): 'book' | 'video' | 'other' {
  if (fileType === 'pdf' || fileType === 'zip') return 'book'
  if (fileType === 'video') return 'video'
  return 'other'
}

export function detectContainerType(ext: string): 'pdf' | 'zip' | 'video' | 'other' {
  const lower = ext.toLowerCase().replace('.', '')
  if (lower === 'pdf') return 'pdf'
  if (['zip', 'cbz'].includes(lower)) return 'zip'
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts', 'mpg', 'mpeg'].includes(lower)) {
    return 'video'
  }
  return 'other'
}
