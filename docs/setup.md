# Setup

Last updated: 2026-04-29

## 사전 요구사항

- Node.js 18 이상
- npm 사용 가능 환경

## 의존성 설치

```bash
npm install
```

## DB 마이그레이션

```bash
npm run db:generate
npm run db:migrate
```

## 개발 모드 실행

```bash
npm run dev
```

## 빌드

```bash
npm run build
```

## 테스트

```bash
npm test
npm run test:e2e
```

## Windows 초기 실행 트러블슈팅

### `No electron app entry file found`

- `package.json`의 `main`이 `out/main/index.js`를 가리키는지 확인합니다.

### `Electron failed to install correctly`

```bash
pnpm rebuild electron
node node_modules/electron/install.js
```

확인:

```bash
node -e "console.log(require('electron'))"
```

### `better-sqlite3` 또는 `sharp` 관련 오류

```bash
npm rebuild better-sqlite3
npx electron-rebuild -f -w better-sqlite3
```

그래도 DB 관련 오류가 반복되면 로컬 DB를 초기화하고 다시 실행합니다.

PowerShell:

```powershell
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item ".\media-library.db" -Force -ErrorAction SilentlyContinue
Remove-Item ".\media-library.db-shm" -Force -ErrorAction SilentlyContinue
Remove-Item ".\media-library.db-wal" -Force -ErrorAction SilentlyContinue
pnpm dev
```

## i18n 작업 가이드

- 엔트리: `src/renderer/src/i18n/index.ts`
- 언어 파일:
  - `src/renderer/src/i18n/locales/en.ts`
  - `src/renderer/src/i18n/locales/ko.ts`
  - `src/renderer/src/i18n/locales/ja.ts`
  - `src/renderer/src/i18n/locales/zh.ts`

### 키 규칙

- 도메인 prefix 사용: `app.*`, `filters.*`, `library.*`, `settings.*`, `common.*`, `detail.*`, `viewer.*`
- 모든 언어에서 같은 의미는 같은 키를 유지
- 변수 치환은 `{name}` 형식 사용

### 새 키 추가 절차

1. `en.ts`에 먼저 추가
2. 나머지 언어 파일에 같은 키 추가
3. 컴포넌트에서는 하드코딩 대신 `tr('...')` 사용
4. 누락 키가 없는지 확인
