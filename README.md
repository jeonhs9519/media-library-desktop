# media-library-desktop

로컬 PDF/CBZ(만화)·동영상 파일을 SQLite 기반으로 태그/평가/썸네일/이어보기까지 관리하는 개인 미디어 라이브러리 데스크톱 앱.

## 실행 방법

### 사전 요구사항

- [Node.js](https://nodejs.org/) 18 이상
- [pnpm](https://pnpm.io/) (`npm install -g pnpm` 또는 `corepack enable`)

### 의존성 설치

```bash
npm install
```

### DB 마이그레이션

```bash
npm run db:generate
npm run db:migrate
```

### 개발 모드 실행

```bash
npm run dev
```

### 빌드 (배포용 패키지 생성)

```bash
npm run build
```

#### 배포(패키징) 예시

- 로컬에서 빌드만 하고 패키징을 별도로 실행하려면:

```bash
npm run build                # electron-vite로 빌드(렌더러/메인)
npm run package:win          # Windows 포터블 패키지 생성
```

- 한 번에 패키징(종속성 준비 포함)하려면 CI 또는 아래 명령을 사용하세요:

```bash
npx electron-builder install-app-deps
npm run package:win
```

#### CI(예: GitHub Actions) 요약

- 워크플로우는 Windows 러너에서 실행되어 Windows 포터블을 생성합니다.
- 서명(옵션): 코드 서명을 위해 PFX 파일을 base64로 인코딩해 `CSC_LINK`(Secret)로, 비밀번호를 `CSC_KEY_PASSWORD`로 등록하세요.

### 릴리스(버전/태그) 가이드

릴리스를 만들 때 `package.json`의 `version`을 태그와 일치시키는 간단한 방법을 권장합니다. 저장소 루트에서 아래 명령으로 패치 버전을 올리고 자동으로 커밋·태그한 뒤 원격에 푸시할 수 있습니다:

```bash
# 패치 버전 증가 및 태그 생성(예: 0.0.3 -> 0.0.4)
npm run release:patch

# 특정 버전으로 직접 지정(예: 0.0.4)
npm run release:patch -- 0.0.4

# 또는 키워드로 증분: patch(기본), minor, major
npm run release:patch -- minor

# 수동 방법(대체)
npm version 0.0.4
git push
git push --tags
```

`npm run release:patch` 명령은 내부적으로 `scripts/release.js`를 실행합니다. 인자를 지정하지 않으면 `patch`(기본)로 동작하며, `-- <value>` 형태로 다음을 전달할 수 있습니다:

- `patch` | `minor` | `major` — `npm version`의 증분 모드
- 또는 `MAJOR.MINOR.PATCH` 형식의 정확한 버전(예: `0.0.4`)

예: `npm run release:patch -- 0.0.4`는 `package.json`의 `version`을 `0.0.4`로 설정하고 커밋·태그·푸시합니다. (로컬에서 실행하세요; 실행 전 변경사항이 없는지 확인하시기 바랍니다.)

릴리스 태그를 푸시하면 CI 워크플로우가 트리거되어 빌드·패키징을 수행하고 Artifacts 중 포터블 EXE만 GitHub Release에 업로드합니다.

권장 워크플로우:
- 로컬에서 `npm run release:patch` 또는 `npm version <x.y.z>`로 버전 증가
- `git push` 및 `git push --tags` (스크립트가 자동으로 수행)
- GitHub Release(또는 CI)를 통해 빌드/업로드 확인

- 자세한 절차와 테스트용 PFX는 `README.CI.md`에 정리되어 있습니다.


### 테스트 실행

```bash
# 유닛 테스트
npm test

# E2E 테스트
npm run test:e2e
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
npm rebuild better-sqlite3
npx electron-rebuild -f -w better-sqlite3
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

## i18n(다국어) 기여 가이드

### 파일 구조

- i18n 엔트리: `src/renderer/src/i18n/index.ts`
- 언어별 사전:
	- `src/renderer/src/i18n/locales/en.ts`
	- `src/renderer/src/i18n/locales/ko.ts`
	- `src/renderer/src/i18n/locales/ja.ts`
	- `src/renderer/src/i18n/locales/zh.ts`

### 키 네이밍 규칙

- 도메인 단위 prefix 사용: `app.*`, `filters.*`, `library.*`, `settings.*`, `common.*`, `detail.*`, `viewer.*`
- 같은 의미의 라벨/문구는 모든 언어에서 동일한 키를 유지
- 변수 치환은 `{name}` 형태 사용 (예: `library.page`, `modal.duplicate.message`)

### 문구 톤 가이드

- 버튼/짧은 라벨: 간결형
- 안내/확인 문구: 자연스러운 문장형
- 언어별 용어는 가능한 한 페이지 전반에서 일관 유지

### 새 키 추가 절차

1. 먼저 `en.ts`에 키를 추가
2. `ko.ts`, `ja.ts`, `zh.ts`에 같은 키를 추가
3. 컴포넌트에서 하드코딩 문자열 대신 `tr('...')` 사용
4. 키가 누락되면 `en`으로 fallback 되므로, PR 전 누락 키가 없는지 확인
