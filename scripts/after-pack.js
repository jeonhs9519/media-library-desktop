const fs = require('fs')
const path = require('path')

// Keep only these locales (Chromium locale filenames like en-US.pak, ko.pak, ja.pak, zh-CN.pak)
const allowed = ['ko', 'en', 'en-US', 'ja', 'zh-CN']

function keepLocale(filename) {
  return allowed.some((a) => filename.startsWith(a))
}

function pruneLocales(dir) {
  if (!fs.existsSync(dir)) return
  const items = fs.readdirSync(dir)
  for (const it of items) {
    const full = path.join(dir, it)
    try {
      const stat = fs.lstatSync(full)
      if (stat.isFile()) {
        if (!keepLocale(it)) fs.unlinkSync(full)
      } else if (stat.isDirectory()) {
        // recurse
        pruneLocales(full)
        // remove empty dirs
        const rem = fs.readdirSync(full)
        if (rem.length === 0) fs.rmdirSync(full)
      }
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Prune ffprobe-static binaries according to build target platform and architecture.
 * This avoids shipping unnecessary binary files on other platforms/architectures, reducing app size.
 *
 * The function safely removes unwanted directories and logs the pruning results.
 *
 * @param {string} appOutDir - Output directory of built app.
 * @param {string} electronPlatformName - Target platform name (win32|linux|darwin).
 * @param {string|object} arch - Target architecture (x64, ia32, arm64, etc.).
 * @param {Array} targets - Additional build targets from context.
 */
function pruneFfprobeStaticUnpacked(appOutDir, electronPlatformName, arch, targets) {
  // `ffprobe-static` ships binaries for multiple platforms/arches.
  // We prune based on the build target so future Linux/macOS builds
  // don't break and don't carry unnecessary binaries.
  const unpackedBinRoot = path.join(
    appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'ffprobe-static',
    'bin',
  )

  if (!fs.existsSync(unpackedBinRoot)) {
    console.warn(`after-pack: ffprobe-static bin directory not found at ${unpackedBinRoot}`)
    return
  }

  const electronBuilderArchNames = {
    0: 'ia32',
    1: 'x64',
    2: 'armv7l',
    3: 'arm64',
    4: 'universal',
  }

  const platformName = (electronPlatformName || process.platform).toString()
  const archInfo = (() => {
    if (!arch) return { archStr: '', archJson: '' }
    if (typeof arch === 'string') return { archStr: arch, archJson: '' }
    if (typeof arch === 'number') return { archStr: electronBuilderArchNames[arch] || '', archJson: String(arch) }

    let archStr = ''
    if (typeof arch.arch === 'string') archStr = arch.arch
    else if (typeof arch.name === 'string') archStr = arch.name
    else if (typeof arch.value === 'string') archStr = arch.value

    // Fallbacks: try toString and/or JSON scan for architecture tokens.
    if (!archStr && typeof arch.toString === 'function') {
      const s = arch.toString()
      if (s && s !== '[object Object]') archStr = s
    }

    let archJson = ''
    try {
      archJson = JSON.stringify(arch)
    } catch {
      archJson = ''
    }

    return { archStr, archJson }
  })()

  // Fallback: if `context.arch` isn't parseable, try `context.targets`.
  let targetsLower = ''
  try {
    const tArr = Array.isArray(targets) ? targets : []
    const tokens = tArr
      .map((t) => {
        // Prefer string-like values.
        if (!t) return ''
        if (typeof t === 'string') return t
        if (typeof t.arch === 'number') return electronBuilderArchNames[t.arch] || String(t.arch)
        if (typeof t.arch === 'string') return t.arch
        if (t.arch && typeof t.arch === 'object') return String(t.arch)
        // JSON may contain tokens like "x64"
        try {
          return JSON.stringify(t)
        } catch {
          return ''
        }
      })
      .filter(Boolean)
    targetsLower = tokens.join(' ').toLowerCase()
  } catch {
    targetsLower = ''
  }

  const archLower = `${archInfo.archStr || ''} ${archInfo.archJson || ''} ${targetsLower}`.toLowerCase()
  const cliLower = process.argv.join(' ').toLowerCase()

  const desiredPlatformDir =
    platformName === 'win32' || platformName === 'linux' || platformName === 'darwin' ? platformName : null

  let desiredArchDir = null
  if (desiredPlatformDir === 'win32') {
    if (archLower.includes('x64')) desiredArchDir = 'x64'
    else if (archLower.includes('ia32')) desiredArchDir = 'ia32'

    // Fallback: parse CLI args (more reliable than `context.arch` shape).
    if (!desiredArchDir) {
      if (cliLower.includes('--x64')) desiredArchDir = 'x64'
      else if (cliLower.includes('--ia32')) desiredArchDir = 'ia32'
    }
  } else if (desiredPlatformDir === 'darwin') {
    if (archLower.includes('arm64')) desiredArchDir = 'arm64'
    else if (archLower.includes('x64')) desiredArchDir = 'x64'

    if (!desiredArchDir) {
      if (cliLower.includes('--arm64')) desiredArchDir = 'arm64'
      else if (cliLower.includes('--x64')) desiredArchDir = 'x64'
    }
  } else if (desiredPlatformDir === 'linux') {
    if (archLower.includes('x64')) desiredArchDir = 'x64'
    else if (archLower.includes('ia32')) desiredArchDir = 'ia32'

    if (!desiredArchDir) {
      if (cliLower.includes('--x64')) desiredArchDir = 'x64'
      else if (cliLower.includes('--ia32')) desiredArchDir = 'ia32'
    }
  }

  // If we can't confidently determine the target arch, keep the current platform as-is
  // to avoid accidentally deleting the only working ffprobe binary.

  const safeRm = (p) => {
    try {
      fs.rmSync(p, { recursive: true, force: true })
      console.log(`after-pack: removed ${p}`)
    } catch (err) {
      console.error(`after-pack: failed to remove ${p}:`, err)
    }
  }

  const platformDirs = fs.readdirSync(unpackedBinRoot)
  for (const platformDirName of platformDirs) {
    const platformDir = path.join(unpackedBinRoot, platformDirName)
    const st = fs.existsSync(platformDir) ? fs.lstatSync(platformDir) : null
    if (!st || !st.isDirectory()) continue

    if (desiredPlatformDir && platformDirName !== desiredPlatformDir) {
      safeRm(platformDir)
      continue
    }

    if (!desiredArchDir) continue

    const archDirs = fs.readdirSync(platformDir)
    for (const archDirName of archDirs) {
      const archDir = path.join(platformDir, archDirName)
      const ast = fs.existsSync(archDir) ? fs.lstatSync(archDir) : null
      if (!ast || !ast.isDirectory()) continue

      if (archDirName !== desiredArchDir) safeRm(archDir)
    }
  }

  const isWin32 = desiredPlatformDir === 'win32'
  if (isWin32 && process.env.DEBUG_AFTER_PACK_FFPROBE === '1') {
    console.log('after-pack debug:', {
      electronPlatformName,
      archType: typeof arch,
      archStr: archInfo.archStr,
      // Keep log size small
      archJsonPreview: (archInfo.archJson || '').slice(0, 200),
      targetsPreview: (targetsLower || '').slice(0, 200),
      cliPreview: cliLower.slice(0, 200),
      decided: { desiredPlatformDir, desiredArchDir },
    })
  }

  console.log(`after-pack: ffprobe-static bin pruned (keep ${desiredPlatformDir || 'all platforms'}/${desiredArchDir || 'all archs'})`)
}

module.exports = async function(context) {
  const appOutDir = context.appOutDir
  try {
    // Chromium locales shipped at top-level "locales" and resources/locales
    pruneLocales(path.join(appOutDir, 'locales'))
    pruneLocales(path.join(appOutDir, 'resources', 'locales'))
    console.log('after-pack: locales pruned')

    pruneFfprobeStaticUnpacked(appOutDir, context.electronPlatformName, context.arch, context.targets)
  } catch (e) {
    console.error('after-pack error:', e)
  }
}
