import sharp from 'sharp'
import JSZip from 'jszip'
import fs from 'fs'

const THUMB_SIZE = 128

export async function generateThumbnailFromCbz(filePath: string): Promise<Buffer | null> {
  try {
    const data = fs.readFileSync(filePath)
    const zip = await JSZip.loadAsync(data)

    const imageFiles = Object.keys(zip.files)
      .filter(name => /\.(jpe?g|png|gif|webp)$/i.test(name) && !zip.files[name].dir)
      .sort(naturalSort)

    if (imageFiles.length === 0) return null

    const firstImage = await zip.files[imageFiles[0]].async('arraybuffer')
    const buffer = Buffer.from(firstImage)

    return await sharp(buffer)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer()
  } catch (e) {
    console.error('CBZ thumbnail error:', e)
    return null
  }
}

export async function resizeToThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer()
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}
