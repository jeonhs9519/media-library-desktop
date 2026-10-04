const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { performance } = require('node:perf_hooks')
const JSZip = require('jszip')
const sharp = require('sharp')

async function main() {
  const directory = path.resolve('.data/cbz-benchmark')
  await fs.mkdir(directory, { recursive: true })
  const filePath = path.join(directory, 'synthetic.zip')
  try { await fs.access(filePath) } catch {
    const image = await sharp(randomBytes(1024 * 1536 * 3), { raw: { width: 1024, height: 1536, channels: 3 } }).jpeg({ quality: 90 }).toBuffer()
    const zip = new JSZip()
    for (let index = 0; index < 96; index++) zip.file(`${index + 1}.jpg`, image)
    await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 1 } }))
  }
  const readLegacy = async index => {
    const started = performance.now()
    const data = fsSync.readFileSync(filePath)
    const readMs = performance.now() - started
    const parsing = performance.now()
    const zip = await JSZip.loadAsync(data)
    const pages = Object.keys(zip.files).filter(name => /\.(jpe?g|png|gif|webp|bmp)$/i.test(name) && !zip.files[name].dir)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    const parseMs = performance.now() - parsing
    const extracting = performance.now()
    Buffer.from(await zip.files[pages[index]].async('arraybuffer')).toString('base64')
    return { totalMs: performance.now() - started, readMs, parseMs, extractAndBase64Ms: performance.now() - extracting }
  }
  const indices = [0, 1, 2, 3, 4, 5, 80, 79]
  const legacy = []
  for (const index of indices) legacy.push(await readLegacy(index))
  const average = values => +(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  const summary = { archiveMiB: +((await fs.stat(filePath)).size / 1024 ** 2).toFixed(2), pages: 96, indices,
    legacy: Object.fromEntries(Object.keys(legacy[0]).map(key => [key, average(legacy.map(row => row[key]))])) }
  if (process.argv.includes('--optimized')) {
    const esbuild = require('esbuild')
    const bundle = path.join(directory, 'service.cjs')
    await esbuild.build({ entryPoints: ['src/main/services/cbzArchive.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle })
    const { CbzArchive } = require(bundle)
    const started = performance.now()
    const archive = await CbzArchive.open(filePath)
    const openMs = performance.now() - started
    const requests = []
    for (const index of indices) {
      const start = performance.now()
      await archive.getPage(index)
      requests.push(performance.now() - start)
    }
    summary.optimized = { openMs: +openMs.toFixed(2), pageMs: average(requests), firstPageIncludingOpenMs: +(openMs + requests[0]).toFixed(2) }
    archive.dispose()
  }
  console.log(JSON.stringify(summary, null, 2))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
