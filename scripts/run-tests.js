const path = require('node:path')
const { spawnSync } = require('node:child_process')

const electron = require('electron')
const vitest = path.join(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs')
const args = process.argv.slice(2)
const result = spawnSync(electron, [vitest, ...(args.includes('--ui') ? [] : ['run']), ...args], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
