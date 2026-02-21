const { execSync } = require('child_process')

function isSemver(v) {
  return /^\d+\.\d+\.\d+$/.test(v)
}

const arg = process.argv[2] || 'patch'

if (arg !== 'patch' && arg !== 'minor' && arg !== 'major' && !isSemver(arg)) {
  console.error('Invalid version argument. Use "patch|minor|major" or exact semver e.g. 0.0.4')
  process.exit(1)
}

try {
  console.log('Running release with version argument:', arg)
  execSync(`npm version ${arg} -m "chore(release): %s"`, { stdio: 'inherit' })
  execSync('git push', { stdio: 'inherit' })
  execSync('git push --tags', { stdio: 'inherit' })
  console.log('Release complete.')
} catch (e) {
  console.error('Release failed:', e && e.message ? e.message : e)
  process.exit(1)
}
