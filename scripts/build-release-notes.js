const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function parseArgs(argv) {
  const args = {
    tag: process.env.GITHUB_REF_NAME || '',
    from: '',
    to: '',
    out: 'RELEASE_NOTES.md',
    saveDocs: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--tag') args.tag = argv[++i] || ''
    else if (arg === '--from') args.from = argv[++i] || ''
    else if (arg === '--to') args.to = argv[++i] || ''
    else if (arg === '--out') args.out = argv[++i] || ''
    else if (arg === '--save-docs') args.saveDocs = true
    else {
      console.error(`Unknown argument: ${arg}`)
      process.exit(1)
    }
  }

  return args
}

function parseVersion(tag) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag)
  if (!match) return null
  return match.slice(1).map(Number)
}

function compareVersion(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a.version[i] !== b.version[i]) return a.version[i] - b.version[i]
  }
  return 0
}

function findPreviousTag(currentTag) {
  const currentVersion = parseVersion(currentTag)
  if (!currentVersion) {
    console.error(`Tag must look like v0.0.7. Received: ${currentTag}`)
    process.exit(1)
  }

  const tags = runGit(['tag', '--list', 'v[0-9]*.[0-9]*.[0-9]*'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((tag) => ({ tag, version: parseVersion(tag) }))
    .filter((item) => item.version)
    .sort(compareVersion)

  const previous = tags
    .filter((item) => compareVersion(item, { tag: currentTag, version: currentVersion }) < 0)
    .pop()

  return previous ? previous.tag : ''
}

function getCommits(range) {
  const raw = runGit(['log', '--format=%H%x1f%s%x1f%b%x1e', range])
  if (!raw) return []

  return raw
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, subject, body = ''] = record.split('\x1f')
      return {
        hash,
        shortHash: hash.slice(0, 7),
        subject: (subject || '').trim(),
        body: (body || '').trim(),
      }
    })
    .filter((commit) => !/^chore\(release\):/.test(commit.subject))
    .filter((commit) => !/^Merge pull request /.test(commit.subject))
    .filter((commit) => commit.subject !== 'Initial plan')
}

const categories = [
  {
    title: '주요 기능',
    match: [
      /^추가:/,
      /플레이리스트|가져오기|HDT|DB|프로필|검색 조건|태그 필터|미사용 태그/i,
      /^feat(\(.+\))?:/i,
    ],
  },
  {
    title: 'UI/UX 개선',
    match: [
      /^수정:/,
      /UI|UX|모달|Modal|toast|페이지네이션|상세|파일 경로|파일 위치|접근성|focus|컨텍스트|설정|화면/i,
      /^fix(\(.+\))?:/i,
    ],
  },
  {
    title: '구조 및 성능',
    match: [
      /startup|성능|속도|구조|리팩토링|분리|IPC|hook|컴포넌트|ffprobe|패키징 바이너리/i,
      /^refactor(\(.+\))?:/i,
    ],
  },
  {
    title: '배포 및 CI',
    match: [
      /^배포:/,
      /GitHub Actions|CI|릴리즈|Release|Artifact|워크플로|workflow/i,
      /^ci(\(.+\))?:/i,
    ],
  },
  {
    title: '문서 및 계획',
    match: [
      /^정리:/,
      /^문서:/,
      /docs|문서|Tauri|commit message|backlog|roadmap|정책|기준|방향/i,
      /^docs(\(.+\))?:/i,
    ],
  },
]

function classify(commit) {
  const subject = commit.subject

  if (/^배포:|^ci(\(.+\))?:|^CI:|GitHub Actions|Artifact|릴리즈|Release/i.test(subject)) {
    return categories.find((category) => category.title === '배포 및 CI')
  }

  if (/startup|성능|속도|구조|리팩토링|분리|IPC|hook|컴포넌트|ffprobe|패키징 바이너리/i.test(subject)) {
    return categories.find((category) => category.title === '구조 및 성능')
  }

  if (/^정리:|^문서:|docs|문서|정책|기준|방향|Tauri|commit message|backlog|roadmap/i.test(subject)) {
    return categories.find((category) => category.title === '문서 및 계획')
  }

  if (/^수정:/.test(subject)) {
    return categories.find((category) => category.title === 'UI/UX 개선')
  }

  const text = `${commit.subject}\n${commit.body}`
  return categories.find((category) => category.match.some((pattern) => pattern.test(text))) || null
}

function summarize(commit) {
  const subject = commit.subject.replace(/^(추가|수정|정리|배포|문서|삭제|보안):\s*/, '')
  return `- ${subject} (${commit.shortHash})`
}

function buildNotes({ tag, previousTag, commits }) {
  const grouped = new Map(categories.map((category) => [category.title, []]))
  const others = []

  for (const commit of commits) {
    const category = classify(commit)
    if (category) grouped.get(category.title).push(commit)
    else others.push(commit)
  }

  const lines = [
    '## 릴리즈 개요',
    '',
    `- 버전: ${tag}`,
    `- 비교 기준: ${previousTag || '첫 릴리즈'}`,
    '',
  ]

  let hasChanges = false
  for (const category of categories) {
    const items = grouped.get(category.title)
    if (!items.length) continue
    hasChanges = true
    lines.push(`## ${category.title}`, '')
    lines.push(...items.map(summarize), '')
  }

  if (others.length) {
    hasChanges = true
    lines.push('## 기타 변경', '')
    lines.push(...others.map(summarize), '')
  }

  if (!hasChanges) {
    lines.push('## 변경 사항', '', '- 변경 내역 없음', '')
  }

  return `${lines.join('\n').trim()}\n`
}

function writeFile(filePath, content) {
  const directory = path.dirname(filePath)
  if (directory && directory !== '.') fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.tag) {
    console.error('Missing tag. Use --tag v0.0.7 or set GITHUB_REF_NAME.')
    process.exit(1)
  }

  const previousTag = args.from || findPreviousTag(args.tag)
  const toRef = args.to || args.tag
  const range = previousTag ? `${previousTag}..${toRef}` : toRef
  const commits = getCommits(range)
  const notes = buildNotes({ tag: args.tag, previousTag, commits })

  writeFile(args.out, notes)
  console.log(`Release notes written to ${args.out}`)
  if (args.saveDocs) {
    const docsOut = path.join('docs', 'release-notes', `${args.tag}.md`)
    writeFile(docsOut, notes)
    console.log(`Release notes saved to ${docsOut}`)
  }
  console.log(`Range: ${range}`)
}

main()
