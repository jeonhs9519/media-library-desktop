# Architecture

Last updated: 2026-05-05

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
- `services/`: IPC 여러 곳에서 재사용하는 도메인 유지보수 기능
- `utils/`: 제목 정규화, 썸네일 생성 등 보조 로직

### `src/preload`

- `index.ts`: `window.api` 브리지를 노출합니다.

### `src/renderer`

- `src/App.tsx`: 라우트 구성
- `src/routes/viewerPages.ts`: 뷰어 route lazy loading과 idle preload 진입점
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
4. 브라우저 창 조기 표시 및 startup 화면 로드
5. SQLite DB 열기 및 마이그레이션 실행
6. IPC 핸들러 등록
7. startup ready 이벤트 전송
8. 렌더러에서 라이브러리 화면 mount 후 `window.api`를 통해 최초 목록 조회
9. 최초 라이브러리 목록 표시 시점에 `library:list-ready` 로그 기록
10. 썸네일 로드와 뷰어 route preload는 목록 표시 이후 비동기로 진행

## Startup 흐름

- `src/main/index.ts`는 startup 단계별 상태를 저장하고 renderer에 `startup:status`, `startup:ready` 이벤트로 전달합니다.
- 각 단계는 `performance.now()` 기준으로 소요 시간을 console에 남깁니다.
- `src/preload/index.ts`는 `window.api.startup` 아래에 `getStatus`, `markLibraryReady`, `onStatus`, `onReady`를 노출합니다.
- `src/renderer/src/App.tsx`의 `StartupGate`는 ready 전까지 startup 화면을 보여주며, ready 이후에만 라우터와 라이브러리 화면을 mount합니다.
- 현재 단계는 창 생성, DB 열기, 마이그레이션, 런타임 스키마 확인, IPC 등록입니다.
- 앱 창은 `ready-to-show`를 기다리지 않고 먼저 표시합니다.
- 최초 라이브러리 목록이 준비되면 renderer가 `startup:markLibraryReady`를 호출하고, main process는 `[startup] library:list-ready ...ms` 로그를 남깁니다.
- 준비 완료 기준은 startup ready 이벤트가 아니라 최초 라이브러리 목록 표시 시점입니다.

## 과거 DB 가져오기

- 앱 시작 시 과거 userData 위치의 `media-library.db`를 자동 복사하지 않습니다.
- 설정 팝업의 `과거 데이터 불러오기`에서 사용자가 직접 기존 `media-library.db`를 선택합니다.
- 설정 팝업 내 진입 UI는 숨김 `input:file`, 파일명을 표시하는 readonly text input, `불러오기` 버튼으로 구성합니다.
- `src/main/ipc/legacyDatabase.ts`는 선택한 DB를 읽기 전용으로 열어 `items` 테이블과 주요 컬럼을 확인하고, 중복/제외 항목 통계를 미리보기로 반환합니다.
- 미리보기 Modal은 720px 폭의 `설정`, `태그`, `파일 정보` 아코디언으로 구성하며, 가져오지 않는 항목은 낮은 opacity로 표시합니다.
- 가져오기 적용 시 중복되지 않은 `items`를 먼저 추가하고, 연결 가능한 `tags`, `itemTags`, `reviews`, `settings`, `playlists`, `playlistItems`를 현재 DB id 기준으로 매핑합니다.
- 기존 설정값은 현재 DB에 같은 key가 없을 때만 가져옵니다.
- 가져오기 후 실제로 사용되지 않는 태그는 `cleanupUnusedTags`로 삭제합니다.

## Renderer Route Loading

- 라이브러리 화면은 초기 route에 포함합니다.
- PDF, CBZ, 비디오 뷰어 route는 `React.lazy`로 분리해 첫 라이브러리 화면 로드에 함께 묶이지 않도록 합니다.
- 최초 라이브러리 목록 표시 이후 idle 시점에 뷰어 route를 미리 import합니다.

## 핵심 도메인

- `items`: 라이브러리의 기본 엔터티
- `tags`: 태그 마스터
- `itemTags`: 아이템-태그 매핑
- `reviews`: 별점/코멘트
- `settings`: 간단한 키-값 설정
- `playlists`: 기본 플레이리스트
- `playlistItems`: 플레이리스트 항목과 표시 순서

## 태그 유지보수

- `src/main/services/tagMaintenance.ts`의 `cleanupUnusedTags`는 `itemTags`에 연결되지 않은 태그를 삭제합니다.
- 사용 건수는 해당 태그가 몇 개의 아이템에 연결되어 있는지로 판단하며, 0건이면 미사용 태그입니다.
- 앱 시작, 라이브러리 목록 로드, 태그 연결/해제, 아이템 삭제 후 호출합니다.
- `getTagUsageCounts`는 사용 중인 태그만 `{ id, name, count }` 형식으로 반환하며, 건수 내림차순과 이름 오름차순으로 정렬합니다.
- `items:getAll`은 `tagIds`를 받으면 선택된 모든 태그가 연결된 아이템만 반환하는 AND 필터를 적용합니다.
- `items:getAll`은 `untagged`를 받으면 태그가 하나도 연결되지 않은 아이템만 반환합니다.

## 주의할 코드 영역

### `src/main/ipc/items/`

- 아이템 관련 IPC 등록 폴더입니다.
- renderer/preload의 `api.items.*` 호출명은 유지하고, main 내부 책임만 세부 파일로 나눕니다.
- `index.ts`: 아이템 IPC 등록 진입점
- `core.ts`: 목록 조회, 상세 조회, 추가, 수정, 삭제, 중복 확인
- `relink.ts`: 개별 relink, 폴더 prefix count, bulk relink
- `imports.ts`: `.hdt` preview/apply
- `metadata.ts`: 누락 메타데이터 보강과 상태 조회
- `utils.ts`: 경로 비교, full path 구성, HDT 보조 타입과 이미지 디코딩
- 목록 조회 응답은 라이브러리 카드와 컨텍스트 메뉴에서 필요한 `sourceUrl` 같은 표시/액션 필드를 포함합니다.
- 목록 검색어는 제목, 파일명, 작가, 메모, 원본 URL을 대상으로 합니다.

### `src/main/ipc/playlists.ts`

- 기본 플레이리스트 조회, 항목 추가, 항목 제거, 초기화, 순서 변경을 담당합니다.
- 항목 추가 시 target position을 받을 수 있으며, 이미 포함된 항목이면 중복 추가 대신 해당 위치로 이동합니다.
- 항목 응답에는 뷰어와 패널에서 즉시 사용할 수 있도록 `thumbnailBase64`를 포함합니다.

### `src/renderer/src/pages/LibraryPage.tsx`

- 메인 라이브러리 화면의 데이터 로드와 조립을 담당하는 허브입니다.
- 검색/필터 툴바, 카드, 목록/페이지네이션, 주요 모달 렌더링은 `src/renderer/src/components/Library/` 아래로 분리되었습니다.
- 파일 추가, `.hdt` 가져오기, 설정/bulk relink 흐름 일부는 전용 hook으로 분리되었습니다.
- `.hdt` 가져오기 진입점은 설정 팝업의 `HDT 가져오기` 항목입니다.
- 검색/필터 상태는 `useLibrarySearchFilters` hook으로 분리되었습니다.
- 썸네일 로드는 `useLibraryThumbnails` hook으로 분리되었습니다.
- metadata fill 흐름은 `useLibraryMetadataFill` hook으로 분리되었습니다.

### `src/renderer/src/components/Library/LibraryGrid.tsx`

- 라이브러리 썸네일 목록, 카드 컨텍스트 메뉴, 하단 페이지네이션을 담당합니다.
- 목록 카운터 위에 현재 검색 조건 요약을 표시합니다.
- 검색 조건 요약은 조건별 inline-block 항목으로 렌더링해 좁은 폭에서도 조건 단위로 줄바꿈합니다.
- 목록은 단일 Tab 진입 영역이며, 썸네일 간 이동은 현재 그리드 폭으로 계산한 방향키 roving focus를 사용합니다.
- 상세 팝업 종료 후 focus request를 받아 다시 목록으로 포커스를 복귀시킵니다.
- 페이지네이션은 이전/다음 caret 버튼과 최대 9개 범위의 페이지 번호 버튼을 표시합니다.

### `src/renderer/src/components/Library/PlaylistPanel.tsx`

- 라이브러리와 뷰어에서 공유하는 플레이리스트 패널입니다.
- 라이브러리 화면에서는 좌/우 표시 설정을 지원하되, HTML 순서는 툴바 다음, 라이브러리 본문 이전으로 유지합니다.
- 항목 클릭으로 뷰어를 열고, 항목별 제거와 전체 초기화를 제공합니다.
- 플레이리스트 항목은 pointer 기반 drag and drop으로 재정렬하며, 삽입 위치 placeholder를 표시합니다.
- 라이브러리 카드 drag and drop으로 플레이리스트에 항목을 추가할 때도 표시된 위치에 삽입합니다.

### `src/renderer/src/components/Library/LibraryToolbar.tsx`

- 검색 조건 모달 진입, 검색 조건 초기화, 파일 추가, 새로고침, 설정 액션을 담당합니다.
- 검색 버튼은 `SearchIcon`, 텍스트, 플랫폼별 단축키 표기를 함께 보여줍니다.
- 새로고침, 설정은 문자열 임시 버튼 대신 SVG 아이콘 버튼을 사용합니다.
- 아이콘 버튼은 시각 텍스트 대신 `title`과 `aria-label`로 의미를 제공합니다.

### `src/renderer/src/components/Library/modals/SearchFiltersModal.tsx`

- 검색어, 타입, 언어, 진행 상태, 파일 상태, 정렬 방식, 정렬 방향, 태그 조건을 한곳에서 지정합니다.
- 태그 조건은 전체, 미지정, 선택 태그 AND 필터 중 하나의 흐름으로 동작합니다.
- 태그 목록은 사용 건수 기준 상위 20개를 기본 표시하고, 하단 전체 폭 버튼으로 더보기/접기를 전환합니다.
- 태그 초기화 버튼은 header 오른쪽에 항상 표시하고, 태그 조건이 없으면 비활성화합니다.
- 정렬 방향은 select가 아니라 아이콘과 문구가 있는 토글 버튼으로 전환합니다.

### `src/renderer/src/pages/ItemDetailPage.tsx`

- 상세 정보 본문을 렌더링하고 태그, 리뷰, 진행률, 파일 정보, relink 흐름을 담당합니다.
- 파일 경로 표시는 OS별 구분자로 정규화합니다. Windows는 `\`, 그 외 OS는 `/`를 사용합니다.
- 파일 섹션 제목 오른쪽에는 `파일 위치 열기` 버튼을 표시하고 `api.file.showInFolder`로 연결합니다.

### `src/renderer/src/components/Library/modals/SettingsModal.tsx`

- 검색 조건 모달과 같은 고정 header/body/footer 구조를 사용합니다.
- 표시 설정, 파일 수정일 변경 규칙, `HDT 가져오기`, 폴더 경로 일괄 변경, 과거 데이터 불러오기 섹션으로 구분합니다.
- `HDT 가져오기`와 과거 데이터 불러오기는 숨김 파일 입력, readonly text input, `불러오기` 버튼 패턴을 사용합니다.
- 폴더 경로 일괄 변경의 대상 항목 수와 실행 버튼은 같은 행에 표시합니다.
- 배율 컨트롤은 `app:getZoomFactor`, `app:zoomIn`, `app:zoomOut`, `app:zoomReset`을 사용해 현재 배율 표시를 즉시 갱신합니다.
- 개발자 도구는 `CodeIcon` 아이콘 버튼으로 제공합니다.

### `src/renderer/src/components/Modal/index.tsx`

- 공용 모달 래퍼입니다.
- `role="dialog"`, `aria-modal`, focus trap, `Escape` 닫기를 제공합니다.
- 중첩 Modal의 표시 순서를 조정할 수 있도록 선택적 `zIndex`를 받을 수 있습니다.

## 테스트 현황

- 단위 테스트: `titleNormalizer`
- E2E: 초기 화면 진입과 버튼 노출 정도

현재 테스트는 최소 수준이므로, 핵심 흐름 보호 장치로는 아직 부족합니다.
