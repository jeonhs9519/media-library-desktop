const { execSync } = require('child_process')

function isSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(v)
}

const arg = process.argv[2] || 'patch'

if (arg !== 'patch' && arg !== 'minor' && arg !== 'major' && !isSemver(arg)) {
  console.error('Invalid version argument. Use "patch|minor|major" or exact semver e.g. 0.0.4')
  process.exit(1)
}

let stashed = false

try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim()
  if (status) {
    const stashMsg = `release-stash-${Date.now()}`
    console.log('Uncommitted changes detected — stashing with message:', stashMsg)
    execSync(`git stash push -u -m "${stashMsg}"`, { stdio: 'inherit' })
    stashed = true
  }

  console.log('Running release with version argument:', arg)
  execSync(`npm version ${arg} -m "chore(release): %s"`, { stdio: 'inherit' })
  execSync('git push', { stdio: 'inherit' })
  execSync('git push --tags', { stdio: 'inherit' })
  console.log('Release complete.')

  if (stashed) {
    try {
      console.log('Restoring stashed changes...')
      execSync('git stash pop', { stdio: 'inherit' })
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
      execSync('git stash pop', { stdio: 'inherit' })
    } catch (popErr) {
      console.error('Failed to pop stash after error:', popErr && popErr.message ? popErr.message : popErr)
      console.error('Manual recovery may be required. See `git stash list`.')
    }
  }

  console.error('Release failed:', e && e.message ? e.message : e)
  process.exit(1)
}
