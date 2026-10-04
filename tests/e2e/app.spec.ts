import { expect, test, _electron, type ElectronApplication, type Page } from '@playwright/test'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(__dirname, '../..')
const executablePath = require('electron') as string
const mainEntry = path.join(root, 'out/main/index.js')

async function launch(directory: string) {
  const app = await _electron.launch({
    executablePath,
    args: ['--disable-gpu', mainEntry],
    cwd: directory,
    env: {
      ...process.env,
      OPEN_DEVTOOLS: '0',
      ELECTRON_RENDERER_URL: pathToFileURL(path.join(root, 'out/renderer/index.html')).href,
    },
  })
  return { app, page: await app.firstWindow() }
}

async function call<T>(page: Page, area: string, method: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(({ area, method, args }) => (window as any).api[area][method](...args), { area, method, args })
}

test.describe('profile and data flows', () => {
  let directory: string
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'media-library-e2e-'))
    await cp(path.join(root, 'src/main/db/migrations'), path.join(directory, 'src/main/db/migrations'), { recursive: true })
    ;({ app, page } = await launch(directory))
    await expect(page.getByRole('heading', { name: '프로필 선택' })).toBeVisible()
  })

  test.afterEach(async () => {
    await app?.close()
    await rm(directory, { recursive: true, force: true })
  })

  test('selects a profile and opens the library', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    await expect(page.getByRole('heading', { name: '프로필 선택' })).toBeHidden()
    await expect(page.locator('.library-main-area')).toBeVisible()
    await app.close()
    ;({ app, page } = await launch(directory))
    await expect(page.getByRole('heading', { name: '프로필 선택' })).toBeVisible()
  })

  test('creates a profile and enters it automatically on the next launch', async () => {
    await page.getByPlaceholder('프로필명 입력').fill('테스트 프로필')
    await page.getByText('다음 실행 시 이 프로필 사용').click()
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const first = await call<any>(page, 'profiles', 'getStatus')
    expect(first.profiles.some((profile: any) => profile.name === '테스트 프로필')).toBe(true)
    expect(first.useLastProfileOnStartup).toBe(true)
    await app.close()
    ;({ app, page } = await launch(directory))
    await expect(page.locator('.library-main-area')).toBeVisible()
    await expect(page.getByRole('heading', { name: '프로필 선택' })).toBeHidden()
    expect((await call<any>(page, 'profiles', 'getStatus')).currentProfileId).toBe(first.currentProfileId)
  })

  test('copies an item with tags and review, then blocks duplicate movement', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const item = await call<any>(page, 'items', 'add', {
      filePath: directory, fileName: 'sample', fileExtension: 'pdf', title: 'Sample',
      contentType: 'book', containerType: 'pdf',
    })
    const tag = await call<any>(page, 'tags', 'create', 'shared tag')
    await call(page, 'tags', 'assignToItem', item.id, tag.id)
    await call(page, 'reviews', 'upsert', item.id, 4, 'review survives copy')
    const target = await call<any>(page, 'profiles', 'createAndSelect', 'Target')
    await call(page, 'profiles', 'select', 3)
    const copy = await call<any>(page, 'items', 'copyToProfile', item.id, target.profile.id)
    expect(copy.ok).toBe(true)
    const targets = await call<any>(page, 'items', 'getMoveTargets', item.id)
    expect(targets.targets.find((profile: any) => profile.id === target.profile.id).reason).toBe('duplicate-file')
    expect((await call<any>(page, 'items', 'moveToProfile', item.id, target.profile.id)).reason).toBe('duplicate-file')
    await call(page, 'profiles', 'select', target.profile.id)
    const copied = await call<any>(page, 'items', 'getById', copy.itemId)
    expect(copied.tags.map((value: any) => value.name)).toContain('shared tag')
    expect(copied.review.comment).toBe('review survives copy')
    await call(page, 'profiles', 'select', 3)
    expect(await call(page, 'items', 'getById', item.id)).not.toBeNull()
  })
})
