# media-library-desktop

로컬 PDF/CBZ(만화)·동영상 파일을 SQLite 기반으로 태그/평가/썸네일/이어보기까지 관리하는 개인 미디어 라이브러리 데스크톱 앱.

## 실행 방법

### 사전 요구사항

- [Node.js](https://nodejs.org/) 18 이상
- [pnpm](https://pnpm.io/) (`npm install -g pnpm` 또는 `corepack enable`)

### 의존성 설치

```bash
pnpm install
```

### DB 마이그레이션

```bash
pnpm db:generate
pnpm db:migrate
```

### 개발 모드 실행

```bash
pnpm dev
```

### 빌드 (배포용 패키지 생성)

```bash
pnpm build
```

### 테스트 실행

```bash
# 유닛 테스트
pnpm test

# E2E 테스트
pnpm test:e2e
```

## Windows 초기 실행 트러블슈팅

### 1) `No electron app entry file found` 오류

- 현재 프로젝트는 Electron 엔트리로 `out/main/index.js`를 사용합니다.
- `pnpm dev` 실행 시 동일 오류가 나면 `package.json`의 `main` 경로가 `out/main/index.js`인지 확인하세요.

### 2) `Electron failed to install correctly` 오류

Electron 바이너리 설치가 누락된 상태입니다.

```bash
pnpm rebuild electron
node node_modules/electron/install.js
```

확인:

```bash
node -e "console.log(require('electron'))"
```

### 3) `better-sqlite3`/`sharp` 네이티브 모듈 오류

네이티브 모듈은 설치/재빌드가 필요할 수 있습니다.

```bash
pnpm rebuild better-sqlite3
pnpm dlx electron-rebuild -f -w better-sqlite3
```

그래도 DB 관련 오류가 반복되면 로컬 DB를 초기화한 뒤 다시 실행하세요:

PowerShell:

```powershell
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item "$env:APPDATA/media-library-desktop/media-library.db" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA/media-library-desktop/media-library.db-shm" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA/media-library-desktop/media-library.db-wal" -Force -ErrorAction SilentlyContinue
pnpm dev
```
