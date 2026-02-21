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

module.exports = async function(context) {
  const appOutDir = context.appOutDir
  try {
    // Chromium locales shipped at top-level "locales" and resources/locales
    pruneLocales(path.join(appOutDir, 'locales'))
    pruneLocales(path.join(appOutDir, 'resources', 'locales'))
    console.log('after-pack: locales pruned')
  } catch (e) {
    console.error('after-pack error:', e)
  }
}
