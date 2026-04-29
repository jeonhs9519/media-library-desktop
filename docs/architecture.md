# Architecture

Last updated: 2026-04-30

## 개요

이 프로젝트는 Electron 데스크톱 앱입니다.

- 메인 프로세스: 앱 생명주기, 창 생성, DB 초기화, IPC 등록
- 프리로드: 렌더러에 안전한 API 브리지 제공
- 렌더러: React UI, 라우팅, 화면 상태 관리
- 데이터 저장: SQLite

## 디렉터리 맵

### `src/main`

- `index.ts`: 앱 시작점, 윈도우 생성, 포터블 경로 처리, DB 초기화, 프로토콜 등록
- `ipc/`: 렌더러에서 호출하는 기능 단위 IPC 핸들러
- `db/`: Drizzle 스키마와 마이그레이션
- `utils/`: 제목 정규화, 썸네일 생성 등 보조 로직

### `src/preload`

- `index.ts`: `window.api` 브리지를 노출합니다.

### `src/renderer`

- `src/App.tsx`: 라우트 구성
- `src/pages/LibraryPage.tsx`: 메인 라이브러리 화면
- `src/pages/*ViewerPage.tsx`: 포맷별 뷰어 화면
- `src/components/`: 공용 UI 조각
- `src/components/Library/`: 라이브러리 화면 전용 툴바, 목록, 카드, 모달, hook
- `src/components/icons/`: 뷰어와 라이브러리에서 공유하는 SVG 아이콘 컴포넌트
- `src/i18n/`: 다국어 리소스

## 런타임 흐름

1. Electron 앱 시작
2. 포터블 경로 및 userData/sessionData 경로 설정
3. startup 상태 IPC 등록
4. 브라우저 창 생성 및 startup 화면 표시
5. SQLite DB 열기 및 마이그레이션 실행
6. IPC 핸들러 등록
7. startup ready 이벤트 전송
8. 렌더러에서 라이브러리 화면 mount 후 `window.api`를 통해 IPC 호출

## Startup 흐름

- `src/main/index.ts`는 startup 단계별 상태를 저장하고 renderer에 `startup:status`, `startup:ready` 이벤트로 전달합니다.
- 각 단계는 `performance.now()` 기준으로 소요 시간을 console에 남깁니다.
- `src/preload/index.ts`는 `window.api.startup` 아래에 `getStatus`, `onStatus`, `onReady`를 노출합니다.
- `src/renderer/src/App.tsx`의 `StartupGate`는 ready 전까지 startup 화면을 보여주며, ready 이후에만 라우터와 라이브러리 화면을 mount합니다.
- 현재 단계는 창 생성, 레거시 DB 확인, DB 열기, 마이그레이션, 런타임 스키마 확인, IPC 등록입니다.

## 핵심 도메인

- `items`: 라이브러리의 기본 엔터티
- `tags`: 태그 마스터
- `itemTags`: 아이템-태그 매핑
- `reviews`: 별점/코멘트
- `settings`: 간단한 키-값 설정

## 주의할 코드 영역

### `src/main/ipc/items.ts`

- 기능이 많이 누적된 핵심 파일입니다.
- 아이템 CRUD, relink, `.hdt` import, 메타데이터 보강까지 맡고 있습니다.
- 목록 조회 응답은 라이브러리 카드와 컨텍스트 메뉴에서 필요한 `sourceUrl` 같은 표시/액션 필드를 포함합니다.
- 이후 기능이 더 늘어나면 `items`, `imports`, `metadata`, `relink` 정도로 분리할 여지가 큽니다.

### `src/renderer/src/pages/LibraryPage.tsx`

- 메인 라이브러리 화면의 데이터 로드와 조립을 담당하는 허브입니다.
- 검색/필터 툴바, 카드, 목록/페이지네이션, 주요 모달 렌더링은 `src/renderer/src/components/Library/` 아래로 분리되었습니다.
- 파일 추가, `.hdt` 가져오기, 설정/bulk relink 흐름 일부는 전용 hook으로 분리되었습니다.
- 검색/필터 상태, 썸네일 로드, metadata fill 흐름은 아직 이 파일에 남아 있어 후속 분리 후보입니다.

### `src/renderer/src/components/Library/LibraryGrid.tsx`

- 라이브러리 썸네일 목록, 카드 컨텍스트 메뉴, 하단 페이지네이션을 담당합니다.
- 목록은 단일 Tab 진입 영역이며, 썸네일 간 이동은 현재 그리드 폭으로 계산한 방향키 roving focus를 사용합니다.
- 상세 팝업 종료 후 focus request를 받아 다시 목록으로 포커스를 복귀시킵니다.
- 페이지네이션은 이전/다음 caret 버튼과 최대 9개 범위의 페이지 번호 버튼을 표시합니다.

### `src/renderer/src/components/Library/LibraryToolbar.tsx`

- 검색, 필터, 정렬, 파일 추가, HDT 가져오기, 새로고침, 설정 액션을 담당합니다.
- 정렬 방향, 새로고침, 설정은 문자열 임시 버튼 대신 SVG 아이콘 버튼을 사용합니다.
- 아이콘 버튼은 시각 텍스트 대신 `title`과 `aria-label`로 의미를 제공합니다.

### `src/renderer/src/components/Modal/index.tsx`

- 공용 모달 래퍼입니다.
- `role="dialog"`, `aria-modal`, focus trap, `Escape` 닫기를 제공합니다.

## 테스트 현황

- 단위 테스트: `titleNormalizer`
- E2E: 초기 화면 진입과 버튼 노출 정도

현재 테스트는 최소 수준이므로, 핵심 흐름 보호 장치로는 아직 부족합니다.
