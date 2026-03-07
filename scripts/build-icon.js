const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const toIco = require('to-ico')

async function main() {
  const rootDir = process.cwd()
  const sourcePng = path.join(rootDir, 'build', 'icon.png')
  const outputIco = path.join(rootDir, 'build', 'icon.ico')

  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Missing icon source: ${sourcePng}`)
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256]
  const pngBuffers = []

  for (const size of sizes) {
    const resized = await sharp(sourcePng)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()

    pngBuffers.push(resized)
  }

  const icoBuffer = await toIco(pngBuffers)
  fs.writeFileSync(outputIco, icoBuffer)
  const stat = fs.statSync(outputIco)
  console.log(`[icon] wrote ${outputIco} (${stat.size} bytes)`)
}

main().catch((error) => {
  console.error('[icon] build failed:', error)
  process.exit(1)
})
