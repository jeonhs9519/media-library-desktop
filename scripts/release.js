const { execFileSync, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function isSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(v)
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options })
}

function read(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim()
}

function getPackageVersion() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  return packageJson.version
}

const arg = process.argv[2] || 'patch'

if (arg !== 'patch' && arg !== 'minor' && arg !== 'major' && !isSemver(arg)) {
  console.error('Invalid version argument. Use "patch|minor|major" or exact semver e.g. 0.0.4')
  process.exit(1)
}

let stashed = false

try {
  const status = read('git', ['status', '--porcelain'])
  if (status) {
    const stashMsg = `release-stash-${Date.now()}`
    console.log('Uncommitted changes detected — stashing with message:', stashMsg)
    execSync(`git stash push -u -m "${stashMsg}"`, { stdio: 'inherit' })
    stashed = true
  }

  console.log('Running release with version argument:', arg)
  execSync(`npm version ${arg} --no-git-tag-version`, { stdio: 'inherit' })

  const version = getPackageVersion()
  const tag = `v${version}`
  const notesPath = path.join('docs', 'release-notes', `${tag}.md`)

  console.log(`Generating release notes: ${notesPath}`)
  run('node', [
    path.join('scripts', 'build-release-notes.js'),
    '--tag',
    tag,
    '--to',
    'HEAD',
    '--out',
    notesPath,
  ])

  run('git', ['add', 'package.json', 'package-lock.json', notesPath])
  run('git', ['commit', '-m', `chore(release): ${version}`])
  run('git', ['tag', tag])
  run('git', ['push'])
  run('git', ['push', '--tags'])
  console.log('Release complete.')

  if (stashed) {
    try {
      console.log('Restoring stashed changes...')
      run('git', ['stash', 'pop'])
    } catch (popErr) {
      console.error('Failed to pop stash:', popErr && popErr.message ? popErr.message : popErr)
      console.error('You may need to restore the stash manually with `git stash list` and `git stash apply`.')
      process.exit(1)
    }
  }
} catch (e) {
  if (stashed) {
    try {
      console.log('Attempting to restore stashed changes after failure...')
      run('git', ['stash', 'pop'])
    } catch (popErr) {
      console.error('Failed to pop stash after error:', popErr && popErr.message ? popErr.message : popErr)
      console.error('Manual recovery may be required. See `git stash list`.')
    }
  }

  console.error('Release failed:', e && e.message ? e.message : e)
  process.exit(1)
}
