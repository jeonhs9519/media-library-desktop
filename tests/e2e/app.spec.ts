import { expect, test, _electron, type ElectronApplication, type Page } from '@playwright/test'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import JSZip from 'jszip'
import sharp from 'sharp'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomBytes } from 'node:crypto'

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

  test('scrolls PDF and ZIP with per-item modes, restores progress, and keeps page resources bounded', async () => {
    test.setTimeout(60_000)
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const zip = new JSZip()
    for (let index = 1; index <= 18; index++) {
      const image = await sharp({ create: { width: 300, height: index % 2 ? 500 : 200, channels: 3, background: '#3366cc' } }).png().toBuffer()
      zip.file(`${String(index).padStart(2, '0')}.png`, image)
    }
    await writeFile(path.join(directory, 'scroll.zip'), await zip.generateAsync({ type: 'nodebuffer' }))
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R 6 0 R] /Count 4 >>',
      ...Array.from({ length: 4 }, (_, index) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 ${index % 2 ? 200 : 500}] /Resources << >> >>`)]
    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
    const xref = Buffer.byteLength(pdf)
    pdf += `xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    await writeFile(path.join(directory, 'scroll.pdf'), pdf)
    const zipItem = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'scroll', fileExtension: 'zip' })
    const pdfItem = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'scroll', fileExtension: 'pdf' })
    await call(page, 'settings', 'set', 'cbz.viewMode', 'double-rtl')
    await call(page, 'settings', 'set', 'pdf.viewMode', 'double-rtl')
    await page.evaluate(() => {
      const active = new Set<string>()
      ;(window as any).scrollUrls = active
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
      URL.createObjectURL = blob => { const url = create(blob); active.add(url); return url }
      URL.revokeObjectURL = url => { active.delete(url); revoke(url) }
    })
    for (const [item, route] of [[zipItem, 'cbz'], [pdfItem, 'pdf']] as const) {
      await page.evaluate(({ id, route }) => { location.hash = `/view/${route}/${id}` }, { id: item.id, route })
      await expect(page.locator('[data-book-scroller]')).toHaveCount(0)
      await expect(page.locator(route === 'cbz' ? '.viewer-root img' : '.viewer-root canvas').first()).toBeVisible()
      await page.keyboard.press('1')
      const scroller = page.locator('[data-book-scroller]')
      await expect(scroller).toBeVisible()
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookViewMode).toBe('scroll')
      await page.keyboard.press('ArrowRight')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBe(1)
      await scroller.evaluate(element => { element.scrollTop = element.scrollHeight })
      const last = route === 'cbz' ? 17 : 3
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBeGreaterThanOrEqual(last - 1)
      expect(await page.locator('[data-book-page]').count()).toBeLessThanOrEqual(8)
      if (route === 'cbz') expect(await page.evaluate(() => (window as any).scrollUrls.size)).toBeLessThanOrEqual(9)
      await page.keyboard.press('Home')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBe(0)
      await page.keyboard.press('ArrowRight')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBe(1)
      const offsetBefore = await scroller.evaluate(element => { element.scrollTop += 80; return element.scrollTop })
      await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(offsetBefore)
      await page.mouse.move(200, 100)
      await page.getByRole('button', { name: '썸네일 설정', exact: true }).click()
      await expect(page.getByText('썸네일이 업데이트되었습니다.', { exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(scroller).toHaveCount(0)
      if (route === 'cbz') await expect.poll(() => page.evaluate(() => (window as any).scrollUrls.size)).toBe(0)
      await page.evaluate(({ id, route }) => { location.hash = `/view/${route}/${id}` }, { id: item.id, route })
      await expect(scroller).toBeVisible()
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBe(1)
      await page.keyboard.press('1')
      await expect(scroller).toHaveCount(0)
      await page.keyboard.press('2')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookViewMode).toBe('double-ltr')
      await page.keyboard.press('2')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookViewMode).toBe('double-rtl')
      await page.keyboard.press('Escape')
    }
  })

  test('keeps long-page scrolling continuous, joins pages, and restores zoom and fractional position in PDF and ZIP', async () => {
    test.setTimeout(90_000)
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const zip = new JSZip()
    const image = await sharp({ create: { width: 300, height: 1500, channels: 3, background: '#335599' } }).png().toBuffer()
    for (let index = 1; index <= 6; index++) zip.file(`${index}.png`, image)
    await writeFile(path.join(directory, 'webtoon.zip'), await zip.generateAsync({ type: 'nodebuffer' }))
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R 6 0 R 7 0 R 8 0 R] /Count 6 >>',
      ...Array.from({ length: 6 }, () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 1500] /Resources << >> >>')]
    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
    const xref = Buffer.byteLength(pdf)
    pdf += `xref\n0 9\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
    await writeFile(path.join(directory, 'webtoon.pdf'), pdf)
    for (const [extension, route] of [['zip', 'cbz'], ['pdf', 'pdf']] as const) {
      await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setSize(1280, 800) })
      const item = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'webtoon', fileExtension: extension })
      await call(page, 'items', 'update', item.id, { bookViewMode: 'scroll', bookScrollZoom: 1, lastPageIndex: 0, bookScrollOffset: 0 })
      await page.evaluate(({ id, route }) => { location.hash = `/view/${route}/${id}` }, { id: item.id, route })
      const scroller = page.locator('[data-book-scroller]')
      await expect(scroller).toBeVisible()
      const row = (index: number) => page.locator(`[data-book-page="${index}"]`)
      await expect.poll(() => row(0).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(4000)
      await expect(row(1)).toBeAttached()
      await expect.poll(() => row(1).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(4000)
      const gap = await page.evaluate(() => {
        const a = document.querySelector('[data-book-page="0"]')!.getBoundingClientRect()
        const b = document.querySelector('[data-book-page="1"]')!.getBoundingClientRect()
        return b.top - a.bottom
      })
      expect(Math.abs(gap)).toBeLessThan(0.1)
      const start = await scroller.evaluate(element => {
        const row = element.querySelector('[data-book-page="0"]') as HTMLElement
        element.scrollTop = row.offsetHeight - element.clientHeight / 4
        return element.scrollTop
      })
      await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(start)
      await page.evaluate(() => {
        ;(window as any).scrollSamples = []
        const started = performance.now()
        const sample = () => {
          ;(window as any).scrollSamples.push(document.querySelector('[data-book-scroller]')!.scrollTop)
          if (performance.now() - started < 600) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
      await page.keyboard.press('ArrowDown')
      const viewport = await scroller.evaluate(element => element.clientHeight)
      await expect.poll(async () => Math.abs((await scroller.evaluate(element => element.scrollTop)) - start - viewport / 2)).toBeLessThan(15)
      const end = await scroller.evaluate(element => element.scrollTop)
      expect(Math.abs(end - start - viewport / 2)).toBeLessThan(15)
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBe(1)
      const samples = await page.evaluate(() => (window as any).scrollSamples as number[])
      const moving = samples.filter(value => value > start + viewport * 0.05 && value < start + viewport * 0.4)
      expect(moving.length).toBeGreaterThan(3)
      expect(moving.every((value, index) => index === 0 || value >= moving[index - 1] - 1)).toBe(true)
      expect(moving.filter((value, index) => index > 0 && Math.abs(value - moving[index - 1]) < 0.1).length).toBeLessThanOrEqual(1)
      await page.keyboard.press('ArrowUp')
      await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeLessThan(start + 15)
      for (const key of ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash']) {
        const before = await scroller.evaluate(element => element.scrollTop)
        await page.keyboard.press('Space')
        await expect.poll(async () => Math.abs((await scroller.evaluate(element => element.scrollTop)) - before - viewport / 2)).toBeLessThan(15)
        await page.keyboard.press(key)
        await expect.poll(async () => Math.abs((await scroller.evaluate(element => element.scrollTop)) - before)).toBeLessThan(15)
      }
      const beforeMenuScroll = await scroller.evaluate(element => element.scrollTop)
      await scroller.click({ button: 'right', position: { x: 200, y: 200 } })
      await page.getByRole('menuitem', { name: /^아래로 스크롤/ }).click()
      await expect.poll(async () => Math.abs((await scroller.evaluate(element => element.scrollTop)) - beforeMenuScroll - viewport / 2)).toBeLessThan(15)
      await scroller.click({ button: 'right', position: { x: 200, y: 200 } })
      await page.getByRole('menuitem', { name: /^위로 스크롤/ }).click()
      await expect.poll(async () => Math.abs((await scroller.evaluate(element => element.scrollTop)) - beforeMenuScroll)).toBeLessThan(15)
      await page.keyboard.press('ArrowRight')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBe(1)
      await page.keyboard.press('ArrowLeft')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBe(0)
      await scroller.click({ button: 'right', position: { x: 200, y: 200 } })
      await page.getByRole('menuitem', { name: /^다음 페이지/ }).click()
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBe(1)
      await scroller.click({ button: 'right', position: { x: 200, y: 200 } })
      await page.getByRole('menuitem', { name: /^이전 페이지/ }).click()
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).lastPageIndex).toBe(0)
      await scroller.evaluate(element => {
        const row = element.querySelector('[data-book-page="1"]') as HTMLElement
        element.scrollTop = row.offsetTop + row.offsetHeight * 0.4
      })
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollOffset).toBeCloseTo(0.4, 2)
      await page.mouse.move(200, 100)
      await expect(page.getByRole('button', { name: '확대', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)')
      await expect(page.getByRole('button', { name: '축소', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)')
      await expect(page.getByRole('button', { name: '배율 초기화', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)')
      await scroller.click({ button: 'right', position: { x: 200, y: 200 } })
      const zoomMenu = page.getByRole('menuitem', { name: /^확대\/축소/ })
      const menuOrder = await page.locator('[role="menu"]').first().locator(':scope > button').allTextContents()
      expect(menuOrder.findIndex(text => text.startsWith('확대/축소'))).toBe(menuOrder.findIndex(text => text.startsWith('페이지 모드')) + 1)
      await zoomMenu.hover()
      const zoomOrder = await page.locator('[role="menu"]').last().locator(':scope > button').allTextContents()
      expect(zoomOrder.map(text => text.replace(/\s/g, ''))).toEqual(['확대+', '배율초기화(100%)0', '축소-'])
      await page.getByRole('menuitem', { name: /^확대\s*\+$/ }).click()
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1.25)
      await scroller.click({ button: 'right', position: { x: 200, y: 200 } })
      await zoomMenu.hover()
      await page.getByRole('menuitem', { name: /^축소\s*-$/ }).click()
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1)
      await page.getByRole('button', { name: '확대', exact: true }).click()
      await scroller.click({ button: 'right', position: { x: 200, y: 200 } })
      await zoomMenu.hover()
      await page.getByRole('menuitem', { name: /배율 초기화/ }).click()
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1)
      await page.keyboard.press('Shift+Equal')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1.25)
      await page.keyboard.press('-')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1)
      await page.keyboard.press('NumpadAdd')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1.25)
      await page.keyboard.press('NumpadSubtract')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1)
      await page.keyboard.press('Shift+Equal')
      await page.keyboard.press('0')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1)
      await page.keyboard.press('NumpadSubtract')
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(0.75)
      await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', code: 'Numpad0', location: 3, bubbles: true })))
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1)
      await page.getByRole('button', { name: '확대', exact: true }).click()
      await page.getByRole('button', { name: '확대', exact: true }).click()
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1.5)
      await expect.poll(async () => (await call<any>(page, 'items', 'getById', item.id)).bookScrollOffset).toBeCloseTo(0.4, 2)
      await expect.poll(() => row(1).evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(1400)
      await scroller.evaluate(element => {
        const row = element.querySelector('[data-book-page="1"]') as HTMLElement
        element.scrollTop = row.offsetTop + row.offsetHeight * 0.65
      })
      await page.keyboard.press('Escape')
      await expect(scroller).toHaveCount(0)
      await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].setSize(900, 720) })
      await page.evaluate(({ id, route }) => { location.hash = `/view/${route}/${id}` }, { id: item.id, route })
      await expect(scroller).toBeVisible()
      await expect.poll(() => scroller.evaluate(element => {
        const row = element.querySelector('[data-book-page="1"]') as HTMLElement
        return row ? (element.scrollTop - row.offsetTop) / row.offsetHeight : 0
      })).toBeCloseTo(0.65, 2)
      if (route === 'pdf') {
        await scroller.evaluate(element => {
          const row = element.querySelector('[data-book-page="1"]') as HTMLElement
          element.scrollTop = row.offsetTop + row.offsetHeight * 0.7
          element.dispatchEvent(new Event('scroll'))
        })
        await app.close()
        ;({ app, page } = await launch(directory))
        await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
        await page.evaluate(id => { location.hash = `/view/pdf/${id}` }, item.id)
        await expect.poll(() => page.locator('[data-book-scroller]').evaluate(element => {
          const row = element.querySelector('[data-book-page="1"]') as HTMLElement
          return row ? (element.scrollTop - row.offsetTop) / row.offsetHeight : 0
        })).toBeCloseTo(0.7, 2)
      }
      await page.keyboard.press('1')
      await expect(page.getByRole('button', { name: '확대', exact: true })).toHaveCount(0)
      await page.keyboard.press('Shift+Equal')
      await page.keyboard.press('-')
      await page.keyboard.press('0')
      expect((await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1.5)
      for (const mode of ['single', 'double-ltr', 'double-rtl']) {
        if (mode !== 'single') await page.keyboard.press('2')
        await page.locator('.viewer-root').click({ button: 'right', position: { x: 200, y: 200 } })
        await expect(page.getByRole('menuitem', { name: /^확대\/축소/ })).toHaveCount(0)
        await expect(page.getByRole('menuitem', { name: /^(위로|아래로) 스크롤/ })).toHaveCount(0)
        await expect(page.locator('[role="menu"]')).toHaveCount(1)
        for (const name of [/^확대\s*\+$/, /배율 초기화/, /^축소\s*-$/]) {
          await expect(page.getByRole('menuitem', { name })).toHaveCount(0)
        }
        expect((await call<any>(page, 'items', 'getById', item.id)).bookScrollZoom).toBe(1.5)
        await page.mouse.click(20, 300)
        await expect(page.locator('[role="menu"]')).toHaveCount(0)
      }
      await page.keyboard.press('Escape')
    }
  })

  test('bounds ZIP images, preloads complete spreads and releases resources across playlist transitions and exit', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    for (const [name, count, color] of [['first', 12, '#3366cc'], ['second', 3, '#cc6633']] as const) {
      const zip = new JSZip()
      const image = await sharp({ create: { width: 40, height: 60, channels: 3, background: color } }).png().toBuffer()
      for (let index = count; index >= 1; index--) zip.file(`${index}.png`, image)
      await writeFile(path.join(directory, `${name}.zip`), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
    }
    const first = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'first', fileExtension: 'zip' })
    const second = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'second', fileExtension: 'zip' })
    await call(page, 'items', 'update', first.id, { lastPageIndex: 4 })
    await call(page, 'items', 'update', second.id, { lastPageIndex: 999 })
    await call(page, 'settings', 'set', 'cbz.viewMode', 'single')
    await call(page, 'playlists', 'addItem', first.id)
    await call(page, 'playlists', 'addItem', second.id)
    await page.evaluate(() => {
      const active = new Set<string>()
      ;(window as any).cbzActiveUrls = active
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
      URL.createObjectURL = blob => { const url = create(blob); active.add(url); return url }
      URL.revokeObjectURL = url => { active.delete(url); revoke(url) }
    })
    const urls = () => page.evaluate(() => [...(window as any).cbzActiveUrls] as string[])
    await page.evaluate(id => { location.hash = `/view/cbz/${id}` }, first.id)
    await expect(page.getByRole('img', { name: 'Page 5', exact: true })).toBeVisible()
    await expect.poll(async () => (await urls()).length).toBe(3)
    const before = await urls()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('img', { name: 'Page 6', exact: true })).toBeVisible()
    expect(before).toContain(await page.getByRole('img', { name: 'Page 6', exact: true }).getAttribute('src'))
    await page.keyboard.press('2')
    await expect(page.getByRole('img', { name: 'Page 7', exact: true })).toBeVisible()
    await expect.poll(async () => (await urls()).length).toBe(6)
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('img', { name: 'Page 8', exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Page 9', exact: true })).toBeVisible()
    await page.keyboard.press('2')
    await expect.poll(() => page.locator('.viewer-root img').evaluateAll(images => images.map(image => image.getAttribute('alt')))).toEqual(['Page 9', 'Page 8'])
    for (let index = 0; index < 20; index++) await page.keyboard.press(index % 2 ? 'ArrowLeft' : 'ArrowRight')
    await expect.poll(async () => (await urls()).length).toBe(6)
    const firstUrls = await urls()
    await page.keyboard.press('PageDown')
    await expect(page).toHaveURL(new RegExp(`#/view/cbz/${second.id}$`))
    await expect(page.getByRole('img', { name: 'Page 3', exact: true })).toBeVisible()
    await expect.poll(async () => (await urls()).length).toBe(2)
    expect((await urls()).some(url => firstUrls.includes(url))).toBe(false)
    await expect.poll(async () => (await call<any>(page, 'items', 'getById', second.id)).lastPageIndex).toBe(2)
    await page.keyboard.press('Escape')
    await expect(page.locator('.viewer-root')).toHaveCount(0)
    await expect.poll(async () => (await urls()).length).toBe(0)
  })

  test('reports invalid and empty ZIPs and ignores late pages after an immediate file switch', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    await writeFile(path.join(directory, 'invalid.zip'), 'not a zip')
    await writeFile(path.join(directory, 'empty.zip'), await new JSZip().generateAsync({ type: 'nodebuffer' }))
    const zip = new JSZip()
    zip.file('1.png', await sharp({ create: { width: 20, height: 30, channels: 3, background: '#33cc66' } }).png().toBuffer())
    await writeFile(path.join(directory, 'valid.zip'), await zip.generateAsync({ type: 'nodebuffer' }))
    const items = []
    for (const fileName of ['invalid', 'empty', 'valid']) items.push(await call<any>(page, 'items', 'add', { filePath: directory, fileName, fileExtension: 'zip' }))
    for (const item of items.slice(0, 2)) {
      await page.evaluate(id => { location.hash = `/view/cbz/${id}` }, item.id)
      await expect(page.getByRole('alert')).toHaveText('ZIP을 열 수 없거나 표시할 이미지가 없습니다.')
    }
    await page.evaluate(id => { location.hash = `/view/cbz/${id}` }, items[2].id)
    await expect(page.getByRole('img', { name: 'Page 1', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.evaluate(id => { location.hash = `/view/cbz/${id}` }, items[2].id)
    await page.evaluate(id => { location.hash = `/view/cbz/${id}` }, items[0].id)
    await expect(page.getByRole('alert')).toHaveText('ZIP을 열 수 없거나 표시할 이미지가 없습니다.')
    await expect(page.locator('.viewer-root img')).toHaveCount(0)
  })

  test('measures first display, cached turns, image decode and a distant jump in a large ZIP', async () => {
    test.setTimeout(60_000)
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const image = await sharp(randomBytes(1024 * 1536 * 3), { raw: { width: 1024, height: 1536, channels: 3 } }).jpeg({ quality: 90 }).toBuffer()
    const zip = new JSZip()
    for (let index = 1; index <= 96; index++) zip.file(`${index}.jpg`, image)
    const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 1 } })
    await writeFile(path.join(directory, 'large.zip'), archive)
    const item = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'large', fileExtension: 'zip' })
    await call(page, 'items', 'update', item.id, { lastPageIndex: 80 })
    await call(page, 'settings', 'set', 'cbz.viewMode', 'single')
    await page.evaluate(() => {
      const timing: any = { decodeMs: [], active: new Set<string>() }
      ;(window as any).cbzTiming = timing
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
      URL.createObjectURL = blob => { const url = create(blob); timing.active.add(url); return url }
      URL.revokeObjectURL = url => { timing.active.delete(url); revoke(url) }
      const decode = HTMLImageElement.prototype.decode
      HTMLImageElement.prototype.decode = async function () {
        const started = performance.now()
        await decode.call(this)
        timing.decodeMs.push(performance.now() - started)
      }
    })
    const firstMs = await page.evaluate(id => new Promise<number>(resolve => {
      const started = performance.now()
      const observer = new MutationObserver(() => {
        const image = document.querySelector<HTMLImageElement>('.viewer-root img[alt="Page 81"]')
        if (image?.complete && image.naturalWidth) requestAnimationFrame(() => {
          observer.disconnect(); resolve(performance.now() - started)
        })
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true })
      location.hash = `/view/cbz/${id}`
    }), item.id)
    await expect.poll(() => page.evaluate(() => (window as any).cbzTiming.active.size)).toBe(3)
    const turn = (key: string, alt: string) => page.evaluate(({ key, alt }) => new Promise<number>(resolve => {
      const started = performance.now()
      const observer = new MutationObserver(() => {
        const image = document.querySelector<HTMLImageElement>(`.viewer-root img[alt="${alt}"]`)
        if (image?.complete && image.naturalWidth) requestAnimationFrame(() => {
          observer.disconnect(); resolve(performance.now() - started)
        })
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true })
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    }), { key, alt })
    const nextMs = await turn('ArrowRight', 'Page 82')
    await expect.poll(() => page.evaluate(() => (window as any).cbzTiming.active.size)).toBe(3)
    const previousMs = await turn('ArrowLeft', 'Page 81')
    const jumpMs = await turn('Home', 'Page 1')
    await page.keyboard.press('2')
    await expect(page.getByRole('img', { name: 'Page 2', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as any).cbzTiming.active.size)).toBe(4)
    const decodeMs = await page.evaluate(() => (window as any).cbzTiming.decodeMs as number[])
    console.log('[cbz-renderer benchmark]', JSON.stringify({ archiveMiB: archive.length / 1024 ** 2, firstMs, nextMs, previousMs, jumpMs,
      meanDecodeMs: decodeMs.reduce((sum, value) => sum + value, 0) / decodeMs.length }))
    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => (window as any).cbzTiming.active.size)).toBe(0)
  })

  test('selects a profile and opens the library', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    await expect(page.getByRole('heading', { name: '프로필 선택' })).toBeHidden()
    await expect(page.locator('.library-main-area')).toBeVisible()
    await app.close()
    ;({ app, page } = await launch(directory))
    await expect(page.getByRole('heading', { name: '프로필 선택' })).toBeVisible()
  })

  test('restores normal window bounds and maximized state on restart', async () => {
    const bounds = await app.evaluate(({ BrowserWindow, screen }) => {
      const window = BrowserWindow.getAllWindows()[0]
      window.unmaximize()
      const area = screen.getPrimaryDisplay().workArea
      const bounds = { x: area.x + 40, y: area.y + 40, width: Math.min(900, area.width - 40), height: Math.min(650, area.height - 40) }
      window.setBounds(bounds)
      return window.getBounds()
    })
    await app.close()
    ;({ app, page } = await launch(directory))
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())).toEqual(bounds)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize())
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())).toBe(true)
    await app.close()
    ;({ app, page } = await launch(directory))
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())).toBe(true)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize())
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())).toEqual(bounds)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setFullScreen(true))
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true)
    await app.close()
    ;({ app, page } = await launch(directory))
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(false)
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())).toEqual(bounds)
  })

  test('keeps video playback and hover progress visible together and hides idle controls', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 64; canvas.height = 64
      const stream = canvas.captureStream(10)
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      const chunks: Blob[] = []
      recorder.ondataavailable = event => chunks.push(event.data)
      const done = new Promise<void>(resolve => { recorder.onstop = () => resolve() })
      recorder.start()
      const draw = setInterval(() => {
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#4a9eff'; ctx.fillRect(0, 0, 64, 64)
      }, 100)
      await new Promise(resolve => setTimeout(resolve, 1200))
      recorder.stop()
      await done
      clearInterval(draw)
      stream.getTracks().forEach(track => track.stop())
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))
    })
    await writeFile(path.join(directory, 'idle.webm'), Buffer.from(bytes))
    const item = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'idle', fileExtension: 'webm', title: 'Idle video' })
    await page.evaluate(id => { location.hash = `/view/video/${id}` }, item.id)
    const video = page.locator('video')
    await expect(video).toBeVisible()
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2)
    await video.evaluate((v: HTMLVideoElement) => {
      v.pause()
      v.currentTime = 0.6
      v.dispatchEvent(new Event('timeupdate'))
    })
    const track = page.locator('.video-progress-track')
    const rect = (await track.boundingBox())!
    for (const ratio of [0.2, 0.8]) {
      await page.mouse.move(rect.x + rect.width * ratio, rect.y + rect.height / 2)
      await expect(page.locator('.video-progress-hover')).toHaveCount(1)
      expect(await page.locator('.video-progress-played').evaluate(el => parseFloat((el as HTMLElement).style.width))).toBeGreaterThan(0)
      const layers = await page.locator('.video-progress-track').evaluate(el => {
        const hover = el.querySelector('.video-progress-hover')!
        const played = el.querySelector('.video-progress-played')!
        return [getComputedStyle(hover).zIndex, getComputedStyle(played).zIndex]
      })
      expect(layers).toEqual(['1', '2'])
      const overlap = await page.locator('.video-progress-overlap').evaluate(el => ({
        width: parseFloat((el as HTMLElement).style.width),
        color: getComputedStyle(el).backgroundColor,
        zIndex: getComputedStyle(el).zIndex,
      }))
      const playedWidth = await page.locator('.video-progress-played').evaluate(el => parseFloat((el as HTMLElement).style.width))
      expect(overlap.width).toBeCloseTo(Math.min(ratio * 100, playedWidth), 0)
      expect(overlap.color).toBe('rgba(255, 255, 255, 0.3)')
      expect(overlap.zIndex).toBe('3')
      await page.screenshot({ path: path.join(root, `test-results/video-seek-hover-${ratio}.png`) })
    }
    const volumeArea = page.locator('.video-volume-hit-area')
    const volumeTrack = page.locator('.video-volume-track')
    const volumeThumb = page.locator('.video-volume-thumb')
    await page.mouse.move(0, 0)
    await expect.poll(() => volumeTrack.evaluate(el => getComputedStyle(el).height)).toBe('4px')
    expect(await volumeTrack.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0.16s')
    const restingThumbCenter = await volumeThumb.evaluate(el => {
      const rect = el.getBoundingClientRect()
      return rect.top + rect.height / 2
    })
    await page.mouse.move((await volumeArea.boundingBox())!.x + 20, (await volumeArea.boundingBox())!.y + 8)
    await page.waitForTimeout(60)
    const transitioningHeight = parseFloat(await volumeTrack.evaluate(el => getComputedStyle(el).height))
    expect(transitioningHeight).toBeGreaterThan(4)
    expect(transitioningHeight).toBeLessThan(12)
    const hoveringThumbCenter = await volumeThumb.evaluate(el => {
      const rect = el.getBoundingClientRect()
      return rect.top + rect.height / 2
    })
    expect(Math.abs(hoveringThumbCenter - restingThumbCenter)).toBeLessThan(0.5)
    await expect.poll(() => volumeTrack.evaluate(el => getComputedStyle(el).height)).toBe('12px')
    await page.mouse.move(0, 0)
    await expect.poll(() => volumeTrack.evaluate(el => getComputedStyle(el).height)).toBe('4px')
    await volumeArea.locator('input').focus()
    await expect.poll(() => volumeTrack.evaluate(el => getComputedStyle(el).height)).toBe('4px')
    await page.screenshot({ path: path.join(root, 'test-results/video-seek-hover.png') })
    await expect(page.locator('.viewer-root')).toHaveClass(/viewer-idle/, { timeout: 4000 })
    await expect(page.locator('.viewer-toolbar').first()).toHaveAttribute('inert', '')
    expect(await video.evaluate(el => getComputedStyle(el).cursor)).toBe('none')
    await page.mouse.move(rect.x + 10, rect.y - 50)
    await expect(page.locator('.viewer-root')).not.toHaveClass(/viewer-idle/)
    await expect(page.locator('.video-progress-hover')).toHaveCount(0)
    await expect(page.locator('.video-progress-overlap')).toHaveCount(0)
    await page.keyboard.press('r')
    await video.evaluate((v: HTMLVideoElement) => v.play())
    await expect(page.locator('.viewer-root')).toHaveClass(/viewer-idle/, { timeout: 4000 })
    await page.keyboard.press('Tab')
    await expect(page.locator('.viewer-root')).not.toHaveClass(/viewer-idle/)
    await expect(page.locator('.viewer-toolbar').first()).not.toHaveAttribute('inert', '')
  })

  for (const sourceIsOlder of [true, false]) {
    test(`renames and merges profile tags while preserving search filters (sourceIsOlder=${sourceIsOlder})`, async () => {
      await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
      const items = []
      for (const fileName of ['first', 'second', 'unrelated']) {
        items.push(await call<any>(page, 'items', 'add', {
          filePath: directory, fileName, fileExtension: 'pdf', title: fileName, contentType: 'book', containerType: 'pdf',
        }))
      }
      const older = await call<any>(page, 'tags', 'create', sourceIsOlder ? 'Before' : 'After')
      await call(page, 'tags', 'assignToItem', items[0].id, older.id)
      const newer = await call<any>(page, 'tags', 'create', sourceIsOlder ? 'After' : 'Before')
      await call(page, 'tags', 'assignToItem', items[1].id, newer.id)
      await call(page, 'tags', 'assignToItem', items[0].id, newer.id)
      const source = sourceIsOlder ? older : newer
      await page.evaluate((id) => sessionStorage.setItem('library.searchState', JSON.stringify({ selectedTagIds: [id] })), source.id)
      await page.reload()
      await expect(page.locator('.library-main-area')).toBeVisible()
      await page.getByRole('button', { name: '설정', exact: true }).click()
      const section = page.locator('.settings-tag-rename')
      const sourceInput = section.getByRole('combobox', { name: '변경 전 태그' })
      const targetInput = section.getByRole('combobox', { name: '변경 후 태그' })
      await expect(sourceInput).toHaveAttribute('placeholder', '변경 전 태그')
      await expect(targetInput).toHaveAttribute('placeholder', '변경 후 태그')
      await expect(section.locator('.settings-row-label')).toHaveCount(0)
      await expect(targetInput).toBeEnabled()
      await expect(section.getByRole('button', { name: '태그명 변경', exact: true })).toBeDisabled()
      await sourceInput.click()
      await expect(section.getByRole('listbox', { name: '변경 전 태그' }).locator('.tag-search-option-count')).toHaveText(['1', '2'])
      await sourceInput.press('Tab')
      await targetInput.click()
      await expect(section.getByRole('listbox', { name: '변경 후 태그' }).locator('.tag-search-option-count')).toHaveText(['2', '1'])
      await targetInput.fill('Af')
      await section.getByRole('option', { name: /After.*#/ }).click()
      await expect(targetInput).toHaveValue('After')
      await expect(targetInput).toHaveAttribute('aria-expanded', 'false')
      const clearTarget = section.getByRole('button', { name: '변경 후 태그: 입력 비우기' })
      const targetBounds = await targetInput.boundingBox()
      const clearBounds = await clearTarget.boundingBox()
      expect(clearBounds!.x).toBeGreaterThan(targetBounds!.x)
      expect(clearBounds!.x + clearBounds!.width).toBeLessThanOrEqual(targetBounds!.x + targetBounds!.width)
      await clearTarget.click()
      await expect(targetInput).toHaveValue('')
      await expect(targetInput).toHaveAttribute('aria-expanded', 'false')
      await expect(clearTarget).toHaveCount(0)
      await expect(section.getByRole('button', { name: '태그명 변경', exact: true })).toBeDisabled()
      await targetInput.fill('Renamed')
      await sourceInput.fill(`#${source.id}`)
      await section.getByRole('option', { name: new RegExp(`Before.*#${source.id}`) }).click()
      await expect(sourceInput).toHaveValue('Before')
      await expect(sourceInput).toHaveAttribute('aria-expanded', 'false')
      await targetInput.click()
      await expect(targetInput).toBeFocused()
      await section.getByRole('button', { name: '변경 전 태그: 입력 비우기' }).click()
      await expect(sourceInput).toHaveValue('')
      await expect(sourceInput).toHaveAttribute('aria-expanded', 'false')
      await expect(section.getByRole('button', { name: '태그명 변경', exact: true })).toBeDisabled()
      await sourceInput.click()
      await expect(sourceInput).toHaveAttribute('aria-expanded', 'true')
      await section.getByRole('option', { name: new RegExp(`Before.*#${source.id}`) }).click()
      await targetInput.fill('Renamed')
      await section.getByRole('button', { name: '태그명 변경', exact: true }).click()
      await expect(section.getByRole('status')).toHaveText('태그명을 변경했습니다.')
      await expect(page.locator('.library-card')).toHaveCount(sourceIsOlder ? 1 : 2)
      await targetInput.fill('미지정')
      await section.getByRole('button', { name: '태그명 변경', exact: true }).click()
      await expect(section.getByRole('status')).toContainText('예약된 이름')
      await targetInput.fill('Af')
      const targetOption = section.getByRole('option', { name: /After.*#/ })
      await expect(targetOption.locator('.tag-search-option-id')).toBeVisible()
      await targetInput.press('ArrowDown')
      await targetInput.press('Enter')
      await expect(targetInput).toHaveValue('After')
      await expect(section.getByText(/내부 id #/)).toContainText(`#${older.id}`)
      await section.getByRole('button', { name: '태그 병합', exact: true }).click()
      await expect(section.getByRole('status')).toHaveText('태그를 병합했습니다.')
      await expect(page.locator('.library-card')).toHaveCount(2)
      await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('library.searchState')!).selectedTagIds)).toEqual([older.id])
      const tags = await call<any[]>(page, 'tags', 'getUsageCounts')
      expect(tags).toEqual([{ id: older.id, name: 'After', count: 2 }])
      await page.getByRole('button', { name: '닫기', exact: true }).click()
      await page.reload()
      await expect(page.locator('.library-card')).toHaveCount(2)
      await page.getByRole('button', { name: '초기화', exact: true }).click()
      await page.getByRole('button', { name: '검색 (Ctrl + F)' }).click()
      await page.getByRole('combobox', { name: '등록된 태그 검색' }).fill('After')
      await expect(page.getByRole('option', { name: /^After/ })).toBeVisible()
      await expect(page.locator('.tag-search-option-id')).toHaveCount(0)
    })
  }

  test('keeps 50 tag candidates in settings with and without a search query', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const item = await call<any>(page, 'items', 'add', {
      filePath: directory, fileName: 'many-tags', fileExtension: 'pdf', title: 'Many tags', contentType: 'book', containerType: 'pdf',
    })
    for (let index = 1; index <= 60; index++) {
      const tag = await call<any>(page, 'tags', 'create', `후보 태그 ${String(index).padStart(2, '0')}`)
      await call(page, 'tags', 'assignToItem', item.id, tag.id)
    }
    await page.reload()
    await page.getByRole('button', { name: '설정', exact: true }).click()
    const section = page.locator('.settings-tag-rename')
    for (const name of ['변경 전 태그', '변경 후 태그']) {
      const input = section.getByRole('combobox', { name })
      const options = section.getByRole('listbox', { name }).getByRole('option')
      await input.click()
      await expect(options).toHaveCount(50)
      await input.fill('후보 태그')
      await expect(options).toHaveCount(50)
      await expect(options.last()).toContainText('후보 태그 50')
      await input.press('Tab')
    }
    await page.getByRole('button', { name: '닫기', exact: true }).click()
    await page.getByRole('button', { name: '검색 (Ctrl + F)' }).click()
    await page.getByRole('combobox', { name: '등록된 태그 검색' }).fill('후보 태그')
    await expect(page.getByRole('listbox', { name: '등록된 태그 검색' }).getByRole('option')).toHaveCount(20)
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
      if (entry.fileType === 'zip') await expect(page.locator('img[src^="blob:"]').first()).toBeVisible()
      if (entry.fileType === 'video') await expect(page.locator('video')).toBeVisible()
      if (entry.fileType !== 'video') {
        await page.mouse.move(400, 300)
        await expect(page.locator('.viewer-root')).toHaveClass(/viewer-idle/, { timeout: 4000 })
        expect(await page.locator('.viewer-root').evaluate(el => getComputedStyle(el).cursor)).toBe('none')
        await page.mouse.move(410, 310)
        await expect(page.locator('.viewer-root')).not.toHaveClass(/viewer-idle/)
      }
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

  test('searches registered tags, keeps selections on one scrollable row and preserves tag controls', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const tagged = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'tagged', fileExtension: 'pdf', title: 'Tagged item' })
    await call(page, 'items', 'add', { filePath: directory, fileName: 'untagged', fileExtension: 'pdf', title: 'Untagged item' })
    for (let index = 1; index <= 24; index++) {
      const tag = await call<any>(page, 'tags', 'create', `검색 태그 ${String(index).padStart(2, '0')}`)
      await call(page, 'tags', 'assignToItem', tagged.id, tag.id)
    }
    const target = await call<any>(page, 'profiles', 'createAndSelect', '다른 프로필')
    const foreignItem = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'foreign', fileExtension: 'pdf' })
    const foreignTag = await call<any>(page, 'tags', 'create', '다른 프로필 태그')
    await call(page, 'tags', 'assignToItem', foreignItem.id, foreignTag.id)
    expect(target.profile.id).toBeGreaterThan(3)
    await call(page, 'profiles', 'select', 3)
    await page.reload()
    await expect(page.locator('.library-card')).toHaveCount(2)
    await page.locator('.library-search-button').click()
    const dialog = page.getByRole('dialog')
    const selected = dialog.getByRole('group', { name: '선택된 태그' })
    const registered = dialog.locator('.search-filter-tags')
    const input = dialog.getByRole('combobox', { name: '등록된 태그 검색' })
    const select = dialog.getByRole('button', { name: '선택', exact: true })
    await expect(registered.locator('.library-tag-chip')).toHaveCount(25)
    await expect(dialog.getByRole('button', { name: /태그 더보기|태그 접기/ })).toHaveCount(0)
    const emptyHeight = await selected.evaluate(element => element.getBoundingClientRect().height)
    expect(await selected.evaluate(element => getComputedStyle(element).overflowX)).toBe('scroll')
    expect(await registered.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
    await registered.hover()
    const searchPosition = await input.evaluate(element => element.getBoundingClientRect().y)
    await page.mouse.wheel(0, 200)
    await expect.poll(() => registered.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
    expect(await input.evaluate(element => element.getBoundingClientRect().y)).toBe(searchPosition)
    await expect(selected).toContainText('선택된 태그 없음')
    await input.fill('다른 프로필 태그')
    await expect(dialog.locator('.tag-search-option')).toHaveCount(0)
    await expect(select).toBeDisabled()
    await input.fill('새로운 태그')
    await input.press('Enter')
    await expect(selected.getByRole('button')).toHaveCount(0)
    await input.fill('검색 태그 24')
    await expect(dialog.getByRole('option', { name: '검색 태그 24 1', exact: true })).toBeVisible()
    await input.press('ArrowDown')
    await input.press('Enter')
    await expect(selected.getByRole('button', { name: '검색 태그 24: 선택 해제' })).toBeVisible()
    await expect(input).toBeFocused()
    await input.fill('검색 태그 23')
    await input.press('Tab')
    await expect(select).toBeFocused()
    await select.press('Enter')
    await expect(selected.getByRole('button')).toHaveCount(2)
    await input.fill('검색 태그 23')
    await expect(select).toBeDisabled()
    await input.fill('')
    await input.press('Tab')
    await expect(registered.locator('.library-tag-chip')).toHaveCount(25)
    for (let index = 1; index <= 12; index++) {
      await registered.getByRole('button', { name: `검색 태그 ${String(index).padStart(2, '0')} 1`, exact: true }).click()
    }
    const layout = await selected.evaluate(element => ({
      scrollable: element.scrollWidth > element.clientWidth,
      rows: new Set(Array.from(element.querySelectorAll('button')).map(button => Math.round(button.getBoundingClientRect().y))).size,
    }))
    expect(layout).toEqual({ scrollable: true, rows: 1 })
    expect(await selected.evaluate(element => element.getBoundingClientRect().height)).toBe(emptyHeight)
    await selected.focus()
    await selected.press('End')
    await selected.getByRole('button', { name: '검색 태그 24: 선택 해제' }).click()
    await expect(selected.getByRole('button')).toHaveCount(13)
    await expect(registered.locator('.library-tag-chip')).toHaveCount(25)
    await page.screenshot({ path: path.join(root, 'test-results/search-tags.png') })
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.locator('.library-card')).toHaveCount(1)
    await expect(page.locator('.library-card')).toContainText('Tagged item')
    await page.reload()
    await expect(page.locator('.library-card')).toHaveCount(1)
    await page.locator('.library-search-button').click()
    await expect(selected.getByRole('button')).toHaveCount(13)
    await registered.getByRole('button', { name: '미지정', exact: true }).click()
    await expect(selected.getByRole('button')).toHaveCount(1)
    await expect(selected).toContainText('미지정')
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.locator('.library-card')).toHaveCount(1)
    await expect(page.locator('.library-card')).toContainText('Untagged item')
    await page.locator('.library-search-button').click()
    await dialog.getByRole('button', { name: '태그 초기화', exact: true }).click()
    await expect(selected.getByRole('button')).toHaveCount(0)
    expect(await selected.evaluate(element => element.getBoundingClientRect().height)).toBe(emptyHeight)
    await expect(dialog.getByRole('button', { name: '태그 초기화', exact: true })).toBeDisabled()
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.locator('.library-card')).toHaveCount(2)
  })

  test('edits language to none and distinguishes it from all and other in search', async () => {
    await page.getByRole('button', { name: '선택한 프로필로 시작' }).click()
    const item = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'language', fileExtension: 'pdf', title: 'Language item', language: 'ko' })
    const unspecified = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'unspecified', fileExtension: 'pdf', title: 'Unspecified language' })
    const noDialogue = await call<any>(page, 'items', 'add', { filePath: directory, fileName: 'none', fileExtension: 'pdf', title: 'No dialogue', language: 'none' })
    await call(page, 'items', 'add', { filePath: directory, fileName: 'other', fileExtension: 'pdf', title: 'Other language', language: 'other' })
    expect((await call<any>(page, 'items', 'getById', unspecified.id)).language).toBe('unspecified')
    expect((await call<any>(page, 'items', 'getById', noDialogue.id)).language).toBe('none')
    await page.reload()
    await page.locator('.library-card').filter({ hasText: 'Language item' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '수정', exact: true }).click()
    await dialog.getByRole('button', { name: '언어', exact: true }).click()
    await dialog.getByRole('option', { name: '없음', exact: true }).click()
    await dialog.getByRole('button', { name: '저장', exact: true }).click()
    await expect(dialog.locator('.detail-type-fields').getByText('없음', { exact: true })).toBeVisible()
    expect((await call<any>(page, 'items', 'getById', item.id)).language).toBe('none')
    await expect(page.locator('.library-card').filter({ hasText: 'No dialogue' }).locator('[aria-label="없음"]')).toHaveText('N/A')
    await dialog.getByRole('button', { name: '수정', exact: true }).click()
    await dialog.getByRole('button', { name: '언어', exact: true }).click()
    await expect(dialog.getByRole('option', { name: '미지정', exact: true })).toHaveAttribute('aria-disabled', 'true')
    await dialog.getByRole('option', { name: '없음', exact: true }).click()
    await dialog.getByRole('button', { name: '저장', exact: true }).click()
    await expect(dialog.locator('.detail-type-fields').getByText('없음', { exact: true })).toBeVisible()
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.locator('.library-card').filter({ hasText: 'Unspecified language' }).locator('[aria-label="없음"]')).toHaveCount(0)
    await page.locator('.library-search-button').click()
    await dialog.getByRole('button', { name: '언어', exact: true }).click()
    await dialog.getByRole('option', { name: '없음', exact: true }).click()
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.locator('.library-card')).toHaveCount(2)
    await expect(page.locator('.library-active-filters')).toContainText('언어: 없음')
    await page.reload()
    await expect(page.locator('.library-card')).toHaveCount(2)
    await page.locator('.library-search-button').click()
    await expect(dialog.getByRole('button', { name: '언어', exact: true })).toHaveText('없음')
    await dialog.getByRole('button', { name: '언어', exact: true }).click()
    await dialog.getByRole('option', { name: '기타', exact: true }).click()
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.locator('.library-card')).toHaveCount(1)
    await expect(page.locator('.library-card')).toContainText('Other language')
    await page.locator('.library-search-button').click()
    await dialog.getByRole('button', { name: '언어', exact: true }).click()
    await dialog.getByRole('option', { name: '미지정', exact: true }).click()
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.locator('.library-card')).toHaveCount(1)
    await expect(page.locator('.library-card')).toContainText('Unspecified language')
    await page.locator('.library-search-button').click()
    await dialog.getByRole('button', { name: '언어', exact: true }).click()
    await dialog.getByRole('option', { name: '전체 언어', exact: true }).click()
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.locator('.library-card')).toHaveCount(4)
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
