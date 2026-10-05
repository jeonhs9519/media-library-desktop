# Setup

Last updated: 2026-10-05

## 사전 요구사항과 설치

- 현재 의존성은 Node.js 22.x에서 22.12 이상을 요구합니다. CI의 `node-version`도 22입니다.
- Windows 개발·배포를 기준으로 확인하며 npm을 사용합니다.
- `package-lock.json` 기준 설치는 다음 명령을 사용합니다. 의존성을 변경할 때는 `npm install`로 lock 파일도 갱신합니다.

```bash
npm ci
```

`postinstall`이 `electron-builder install-app-deps`를 실행해 Electron용 native 모듈을 준비합니다.

## 개발 앱과 데이터

```bash
npm run dev
```

- 개발 앱은 실행 작업 디렉터리의 `media-library.db`와 `.data/`를 사용하므로 프로젝트 루트에서 실행합니다.
- 배포 앱은 실행 파일 폴더를 사용하며 포터블 실행 환경에서 `PORTABLE_EXECUTABLE_DIR`이 있으면 그 폴더를 사용합니다.
- `.data/`에는 `user-data/`, `session-data/`, `logs/`, `crash-dumps/`가 있습니다. 창 상태는 `user-data/window-state.json`에 저장합니다.
- 과거 userData DB는 자동 복사하지 않습니다. 설정 → 프로필 관리 → 과거 데이터 불러오기에서 선택해 미리보기 후 적용합니다.
- 폴더 이동·백업 전 이 프로젝트의 앱을 종료하고 DB와 `.data/`를 함께 복사합니다. DB 옆에 `-wal`·`-shm` 파일이 남아 있으면 같은 백업에 포함합니다.

### Codex Desktop 실행

- 기본 샌드박스의 개발 앱 실행은 `spawn EPERM`으로 실패할 수 있으므로 실행 요청 시 승인된 권한으로 `npm.cmd run dev`를 바로 실행합니다.
- 코드·구조·main/preload 변경 후 동작 확인은 기존 프로젝트 앱을 종료하고 새로 실행한 앱 기준으로 수행합니다.
- 다른 프로젝트의 Electron 앱까지 일괄 종료하지 않습니다.

## DB 스키마와 마이그레이션

- 앱 시작 시 `src/main/db/migrate.ts`의 `runMigrations`와 `ensureRuntimeSchema`를 실행합니다. 일반 실행 전 별도 수동 마이그레이션은 필요하지 않습니다.
- 스키마는 `src/main/db/schema.ts`, 마이그레이션은 `src/main/db/migrations/`에서 관리합니다.
- 스키마 변경 시 생성된 SQL과 기존 DB 보존 처리를 검토합니다.

```bash
npm run db:generate
```

`db:migrate` script도 정의되어 있지만 현재 `drizzle.config.ts`에는 대상 DB의 `dbCredentials`가 없습니다. 일반 실행·업데이트 절차에는 사용하지 않으며, 수동 적용이 필요하면 먼저 별도 테스트 DB와 설정을 명시합니다.

## 검사와 빌드

```bash
npm test
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.web.json
npm run build
npm run test:e2e
```

- `npm test`는 `scripts/run-tests.js`에서 Electron의 Node 실행 모드로 Vitest를 실행합니다. native SQLite 통합 테스트를 포함하므로 일반 Node에서 Vitest만 직접 실행하는 방식과 구분합니다.
- 두 타입 검사는 각각 main/preload와 renderer를 검사합니다. `npm run build`는 이를 대신하지 않습니다.
- `test:e2e`는 자체 production build 후 테스트마다 임시 데이터 폴더에서 Electron을 실행합니다. OS 파일 선택·외부 URL은 필요한 시나리오에서 대체하며 실제 사용자 데이터는 사용하지 않습니다.
- `npm run test:ui`는 Vitest UI를 엽니다. 특정 테스트 실행 예는 `npm test -- tests/unit/toast.test.ts`입니다.
- 최신 구현 검증 결과는 [Current Status](current-status.md)에 기록합니다. 릴리즈 검사·패키징은 [Release And CI](release-ci.md)를 따릅니다.

### ZIP 성능 확인

파일 처리 측정:

```bash
node scripts/benchmark-cbz.cjs --optimized
```

Electron 화면 측정:

```bash
npm run build
npx playwright test -g "measures first display"
```

합성 fixture와 당시 측정값의 조건·한계는 [ZIP 성능](zip-performance.md)을 참조합니다.

## Windows 오류 대응

### `No electron app entry file found`

`package.json`의 `main`은 `out/main/index.js`입니다. 프로젝트 루트에서 의존성을 설치하고 `npm run build` 후 다시 실행합니다.

### `Electron failed to install correctly`

```bash
npm rebuild electron
node node_modules/electron/install.js
node -e "console.log(require('electron'))"
```

### `better-sqlite3` 또는 `sharp` 로딩 오류

이 프로젝트의 앱을 종료한 뒤 설치 상태를 먼저 복구합니다.

```bash
npm ci
npx electron-builder install-app-deps
```

`better-sqlite3`의 Node/Electron ABI 불일치는 DB 내용과 별개입니다. 호스트 Node용 rebuild나 미설치 `electron-rebuild` 호출 대신 프로젝트의 Electron용 설치 경로와 `npm test` 실행 방식을 사용합니다. 문제가 남으면 오류에 나온 모듈·ABI·파일 경로와 앱 로그를 확인합니다.

### DB 오류

- 앱을 종료하고 DB·남은 `-wal`/`-shm`·`.data/`를 먼저 백업합니다.
- 오류 로그에서 권한·파일 잠금·마이그레이션·손상을 구분합니다.
- 재현은 임시 복사본에서 수행합니다. 실제 DB 삭제나 다른 앱 프로세스 일괄 종료를 기본 복구 절차로 사용하지 않습니다.

### `spawn EPERM`

빌드·테스트 도구의 자식 프로세스가 실행 제한에 걸렸는지 확인합니다. 필요한 명령을 승인된 실행 환경에서 다시 수행하며 데이터 초기화로 해결하지 않습니다.

## i18n 작업 기준

- 엔트리는 `src/renderer/src/i18n/index.ts`이며 공용 번역 함수 타입 `Translate`를 내보냅니다.
- 언어 리소스는 `src/renderer/src/i18n/locales/`의 `en.ts`, `ko.ts`, `ja.ts`, `zh.ts`입니다.
- 도메인 prefix(`app.*`, `filters.*`, `library.*`, `settings.*`, `common.*`, `detail.*`, `viewer.*`)와 `{name}` 변수 치환을 사용합니다.
- 새 키는 en에 추가한 뒤 나머지 언어에 같은 키를 추가하고 컴포넌트에서 `tr('...')`로 호출합니다. 누락 키와 하드코딩을 확인합니다.
