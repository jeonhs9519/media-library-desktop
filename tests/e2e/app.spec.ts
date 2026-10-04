import { expect, test, _electron, type ElectronApplication, type Page } from '@playwright/test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import JSZip from 'jszip'
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

  test('keeps details open after dragging outside and closes only the top dialog', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    await call(page, 'items', 'add', {
      filePath: directory, fileName: 'notice', fileExtension: 'pdf', title: 'PDF 공고문',
      contentType: 'book', containerType: 'pdf',
    })
    await call(page, 'items', 'add', {
      filePath: directory, fileName: 'photos', fileExtension: 'zip', title: 'ZIP 사진 모음',
      contentType: 'comic', containerType: 'zip',
    })
    await page.reload()
    await expect(page.locator('.library-main-area')).toBeVisible()
    const card = page.locator('.library-card').filter({ hasText: 'PDF 공고문' })
    await expect(card.getByText('B', { exact: true })).toHaveCount(1)
    await expect(card.getByRole('img', { name: '썸네일 미지정' })).toHaveText('N/A')
    await expect(page.locator('.library-card').filter({ hasText: 'ZIP 사진 모음' }).getByText('C', { exact: true }).first()).toBeVisible()
    await card.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('도서', { exact: true })).toBeVisible()
    await expect(dialog.getByText('PDF', { exact: true })).toBeVisible()
    const title = dialog.getByText('PDF 공고문', { exact: true })
    const bounds = await title.boundingBox()
    expect(bounds).not.toBeNull()
    const inside = { x: bounds!.x + 10, y: bounds!.y + bounds!.height / 2 }

    await page.mouse.move(inside.x, inside.y)
    await page.mouse.down()
    await page.mouse.move(5, 5, { steps: 8 })
    await page.mouse.up()
    await expect(dialog).toBeVisible()

    await page.mouse.move(5, 5)
    await page.mouse.down()
    await page.mouse.move(inside.x, inside.y, { steps: 8 })
    await page.mouse.up()
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: '삭제', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(2)
    await page.mouse.click(5, 5)
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await page.mouse.click(5, 5)
    await expect(dialog).toHaveCount(0)
    await expect(card).toBeFocused()

    await card.click()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(card).toBeFocused()

    await page.locator('.library-card').filter({ hasText: 'ZIP 사진 모음' }).click()
    await expect(dialog.getByText('만화책', { exact: true })).toBeVisible()
    await expect(dialog.getByText('ZIP', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await page.locator('.library-search-button').click()
    await dialog.getByRole('button', { name: '콘텐츠 타입', exact: true }).click()
    await expect(dialog.getByRole('option', { name: '도서', exact: true })).toBeVisible()
    await expect(dialog.getByRole('option', { name: '만화책', exact: true })).toBeVisible()
  })

  test('edits content independently from file type, viewer, progress, and playlist', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const zip = new JSZip()
    zip.file('1.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'))
    await writeFile(path.join(directory, 'photos.zip'), await zip.generateAsync({ type: 'nodebuffer' }))
    const pdfObjects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>',
    ]
    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    pdfObjects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf))
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    })
    const xrefOffset = Buffer.byteLength(pdf)
    pdf += `xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    await writeFile(path.join(directory, 'notice.pdf'), pdf)
    await writeFile(path.join(directory, 'movie.mp4'), '')
    const entries = [
      { fileName: 'notice', fileExtension: 'pdf', title: 'Independent PDF', contentType: 'book', fileType: 'pdf', fileLabel: 'PDF', route: 'pdf', newLabel: '동영상', newType: 'video', totalContent: 1 },
      { fileName: 'photos', fileExtension: 'zip', title: 'Independent ZIP', contentType: 'book', fileType: 'zip', fileLabel: 'ZIP', route: 'cbz', newLabel: '만화책', newType: 'comic', totalContent: 1 },
      { fileName: 'movie', fileExtension: 'mp4', title: 'Independent video', contentType: 'video', fileType: 'video', fileLabel: '동영상 파일', route: 'video', newLabel: '도서', newType: 'book', totalContent: 120 },
    ]
    for (const entry of entries) {
      const added = await call<any>(page, 'items', 'add', { filePath: directory, fileName: entry.fileName, fileExtension: entry.fileExtension, title: entry.title })
      expect(added.contentType).toBe(entry.contentType)
      expect(added.containerType).toBe(entry.fileType)
      await call(page, 'items', 'update', added.id, { totalContent: entry.totalContent, progress: 0.5 })
      await page.reload()
      const card = page.locator('.library-card').filter({ hasText: entry.title })
      await card.click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: '수정', exact: true }).click()
      await expect(dialog.getByRole('button', { name: '파일 타입', exact: true })).toHaveCount(0)
      await expect(dialog.getByRole('textbox', { name: '파일 타입', exact: true })).toHaveValue(entry.fileLabel)
      await dialog.getByRole('button', { name: '콘텐츠 타입', exact: true }).click()
      await dialog.getByRole('option', { name: entry.newLabel, exact: true }).click()
      await dialog.getByRole('button', { name: '저장', exact: true }).click()
      await expect(dialog.getByText(entry.newLabel, { exact: true })).toBeVisible()
      const saved = await call<any>(page, 'items', 'getById', added.id)
      expect(saved.contentType).toBe(entry.newType)
      expect(saved.containerType).toBe(entry.fileType)
      await dialog.getByRole('button', { name: '리스트에 추가', exact: true }).click()
      await expect.poll(async () => (await call<any[]>(page, 'playlists', 'getItems')).some(row => row.itemId === added.id)).toBe(true)
      await dialog.getByRole('button', { name: '닫기', exact: true }).click()
      await expect(card.getByText(entry.fileType === 'video' ? '01:00/02:00' : '1/1p', { exact: true })).toBeVisible()
      await card.click()
      await dialog.getByRole('button', { name: '뷰어 열기', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`#/view/${entry.route}/${added.id}$`))
      if (entry.fileType === 'pdf') await expect(page.locator('canvas').first()).toBeVisible()
      if (entry.fileType === 'zip') await expect(page.locator('img[src^="data:image/"]').first()).toBeVisible()
      if (entry.fileType === 'video') await expect(page.locator('video')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
    }
    await page.locator('.library-search-button').click()
    const searchDialog = page.getByRole('dialog')
    await searchDialog.getByRole('button', { name: '콘텐츠 타입', exact: true }).click()
    await searchDialog.getByRole('option', { name: '만화책', exact: true }).click()
    await searchDialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.locator('.library-card')).toHaveCount(1)
    await expect(page.locator('.library-card')).toContainText('Independent ZIP')
  })

  test('pastes into editable fields and displays three metadata fields on one row', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const item = await call<any>(page, 'items', 'add', {
      filePath: directory, fileName: 'paste', fileExtension: 'pdf', title: 'ABcdEF',
      author: 'Original author', sourceUrl: 'https://example.com/original',
    })
    await page.reload()
    await page.locator('.library-card').filter({ hasText: 'ABcdEF' }).click()
    const dialog = page.getByRole('dialog')
    const row = dialog.locator('.detail-type-fields')
    const checkRow = async () => {
      const bounds = await row.locator(':scope > div').evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width }
      }))
      expect(bounds).toHaveLength(3)
      expect(Math.abs(bounds[0].y - bounds[1].y)).toBeLessThan(1)
      expect(Math.abs(bounds[1].y - bounds[2].y)).toBeLessThan(1)
      expect(Math.abs(bounds[0].width - bounds[1].width)).toBeLessThan(1)
      expect(Math.abs(bounds[1].width - bounds[2].width)).toBeLessThan(1)
      expect(bounds[0].x).toBeLessThan(bounds[1].x)
      expect(bounds[1].x).toBeLessThan(bounds[2].x)
    }
    await checkRow()
    await dialog.getByRole('button', { name: '수정', exact: true }).click()
    await checkRow()
    const fileType = dialog.getByRole('textbox', { name: '파일 타입', exact: true })
    await expect(fileType).toHaveAttribute('readonly', '')
    await fileType.focus()
    await page.keyboard.type('zip')
    await expect(fileType).toHaveValue('PDF')
    await expect(dialog.getByRole('button', { name: /: 붙여넣기$/ })).toHaveCount(3)
    const overlays = await dialog.locator('.paste-input-control').evaluateAll(elements => elements.map(element => {
      const input = element.querySelector('input')!.getBoundingClientRect()
      const button = element.querySelector('button')!
      const bounds = button.getBoundingClientRect()
      const style = getComputedStyle(button)
      return {
        inside: bounds.x >= input.x && bounds.right <= input.right && bounds.y >= input.y && bounds.bottom <= input.bottom,
        circular: bounds.width === bounds.height && style.borderRadius === '50%',
        transparent: style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '0px',
        iconOnly: button.querySelectorAll('svg').length === 1 && !button.textContent?.trim(),
      }
    }))
    expect(overlays).toEqual(Array(3).fill({ inside: true, circular: true, transparent: true, iconOnly: true }))
    // OS 클립보드를 바꾸지 않고 네이티브 읽기 결과만 대체합니다.
    await app.evaluate(({ clipboard }) => {
      ;(globalThis as any).__originalClipboardReadText = clipboard.readText
    })
    const clipboardText = async (value: string) => app.evaluate(({ clipboard }, text) => {
      clipboard.readText = () => text
    }, value)
    try {
      const title = dialog.getByRole('textbox', { name: '제목', exact: true })
      await title.focus()
      await title.evaluate((element: HTMLInputElement) => element.setSelectionRange(2, 4))
      await clipboardText('X')
      await dialog.getByRole('button', { name: '제목: 붙여넣기' }).click()
      await expect(title).toHaveValue('X')
      await expect(title).toBeFocused()
      expect(await title.evaluate((element: HTMLInputElement) => element.selectionStart)).toBe(1)
      await clipboardText('')
      await dialog.getByRole('button', { name: '제목: 붙여넣기' }).click()
      await expect(title).toHaveValue('')
      await expect(title).toBeFocused()
      await clipboardText('X')
      await dialog.getByRole('button', { name: '제목: 붙여넣기' }).click()
      await expect(title).toHaveValue('X')

      const author = dialog.getByRole('textbox', { name: '작성자', exact: true })
      await clipboardText('테스트\r\n작성자')
      const authorPaste = dialog.getByRole('button', { name: '작성자: 붙여넣기' })
      await authorPaste.focus()
      await authorPaste.press('Enter')
      await expect(author).toHaveValue('테스트 작성자')
      await expect(author).toBeFocused()

      const sourceUrl = dialog.getByRole('textbox', { name: '출처 URL', exact: true })
      await clipboardText('https://example.com/pasted')
      await dialog.getByRole('button', { name: '출처 URL: 붙여넣기' }).click()
      await expect(sourceUrl).toHaveValue('https://example.com/pasted')
      await page.screenshot({ path: path.join(root, 'test-results/detail-editing.png') })

      await app.evaluate(({ clipboard }) => {
        clipboard.readText = () => { throw new Error('clipboard unavailable') }
      })
      await dialog.getByRole('button', { name: '작성자: 붙여넣기' }).click()
      await expect(dialog.getByRole('alert')).toContainText('클립보드를 읽지 못했습니다')
      await expect(author).toHaveValue('테스트 작성자')
      await dialog.getByRole('button', { name: '저장', exact: true }).click()
      await expect(dialog.getByRole('button', { name: /: 붙여넣기$/ })).toHaveCount(0)
      expect(await call(page, 'items', 'getById', item.id)).toMatchObject({
        title: 'X', author: '테스트 작성자', sourceUrl: 'https://example.com/pasted',
      })
      await checkRow()
      await page.screenshot({ path: path.join(root, 'test-results/detail-metadata-row.png') })
    } finally {
      await app.evaluate(({ clipboard }) => {
        clipboard.readText = (globalThis as any).__originalClipboardReadText
        delete (globalThis as any).__originalClipboardReadText
      })
    }
  })
})
