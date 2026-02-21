export function normalizeTitle(fileName: string): string {
  let title = fileName.replace(/\.[^/.]+$/, '')
  title = title.replace(/\[.*?\]/g, '')
  title = title.replace(/\{.*?\}/g, '')
  title = title.replace(/\((?:19|20)\d{2}\)/gi, '')
  title = title.replace(/\((?:HD|SD|4K|2K|1080p?|720p?|480p?|360p?|BluRay|BDRip|DVDRip|WEBRip|WEB-DL|HDTV|x264|x265|H\.264|H\.265|AAC|MP3|HEVC|AVC)[^)]*\)/gi, '')
  title = title.replace(/\s+/g, ' ').trim()
  return title || fileName
}

export function detectContentType(ext: string): 'book' | 'comic' | 'video' | 'other' {
  const lower = ext.toLowerCase().replace('.', '')
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'ts', 'mpg', 'mpeg'].includes(lower)) {
    return 'video'
  }
  if (['pdf', 'epub', 'mobi', 'azw', 'azw3', 'fb2'].includes(lower)) {
    return 'book'
  }
  if (['cbz', 'cbr', 'zip', 'cb7'].includes(lower)) {
    return 'comic'
  }
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
