# Architecture

Last updated: 2026-10-06

## 개요

이 프로젝트는 Electron 데스크톱 앱입니다.

- 메인 프로세스: 앱 생명주기, 창 생성, DB 초기화, IPC 등록
- 프리로드: 렌더러에 안전한 API 브리지 제공
- 렌더러: React UI, 라우팅, 화면 상태 관리
- 데이터 저장: SQLite

현재 구현은 Electron 기준입니다. 이 문서는 모듈 구조 개요이며 Tauri 재구축을 위한 상세 분석서와 구분합니다.

## 디렉터리 맵

### `src/main`

- `index.ts`: 앱 시작점, 윈도우 생성, 포터블 경로 처리, DB 초기화, 프로토콜 등록
- `ipc/`: 렌더러에서 호출하는 기능 단위 IPC 핸들러
- `ipc/items/core.ts`와 `ipc/reviews.ts`는 저장 전 사용자 텍스트의 앞뒤 공백을 제거합니다. 제목·작성자·메모·출처 URL·리뷰의 빈 문자열을 유지하며, `ipc/tags.ts`는 태그 생성 이름을 정리하고 빈 이름을 거절합니다. 상세보기는 정리한 입력값을 상태에도 반영해 재편집 시 같은 값을 표시합니다.
- `db/`: Drizzle 스키마와 마이그레이션
- `services/`: IPC 여러 곳에서 재사용하는 도메인 유지보수 기능
- `services/windowState.ts`: 창 저장값 검증과 모니터 작업 영역에 따른 복원 좌표 계산. `index.ts`가 userData JSON 저장과 BrowserWindow 이벤트를 연결합니다.
- `services/cbzArchive.ts`: 한 번 연 ZIP의 이미지 목록과 압축 데이터 재사용, 이미지 MIME type과 바이너리 반환, 동일 페이지의 진행 중 요청 합류를 처리합니다. `ipc/cbz.ts`가 sender별 세션과 종료·reload 정리를 연결합니다.
- `utils/`: 제목 정규화, 썸네일 생성 등 보조 로직

### `src/preload`

- `index.ts`: `window.api` 브리지를 노출합니다. 창 capture 단계에서 마우스 보조 버튼 3·4의 기본 방문 기록 이동과 이벤트 전파를 차단합니다.
- `api.clipboard.readText()`는 `main/ipc/clipboard.ts`의 IPC로 시스템 클립보드 텍스트를 읽습니다. 사용자가 붙여넣기 버튼을 누를 때만 호출합니다.

### `src/renderer`

- `src/App.tsx`: 시작·프로필 gate와 라우트 구성
- `src/components/Startup/StartupGate.tsx`: startup 상태 구독, 준비 화면과 route fallback
- `src/components/Profile/`: `ProfileGate`의 선택 화면, `useProfileSelection`의 조회·생성·선택·삭제 상태, `ProfileDeleteModal`의 삭제·이관 확인 UI
- `src/types/profile.ts`: 프로필 선택·설정 화면에서 공유하는 상태·요약 타입
- `src/routes/LibraryLayout.tsx`: 공통 라우트에서 라이브러리 화면을 보존하고 뷰어만 전환합니다. 숨긴 목록의 조작·접근성을 차단하고 복귀 레이아웃 반영 후 스크롤을 복원합니다. 상세보기 id는 `useMatch`로 읽으며 뷰어에서는 Modal과 검색 단축키를 비활성화합니다.
- `src/libraryUpdates.ts`: 항목 저장 결과 구독과 목록 필드 갱신, 읽기 상태 필터·수정일 정렬의 재조회 필요 여부를 판정합니다. `api.items.update`는 저장 완료 후 이벤트를 발행하며 목록은 뷰어 동안 필요한 재조회만 모아 복귀 시 처리합니다.
- `src/thumbnailCache.ts`: 렌더러 세션의 썸네일 결과·진행 중 요청 공유와 구독을 처리합니다. `api.ts`는 썸네일 저장·항목 삭제/이동 후 해당 캐시를 무효화하고 프로필 전환·삭제 시 전체를 비웁니다. `useLibraryThumbnails`는 목록 교체·화면 이동 후에도 결과를 유지합니다.
- `src/useViewerIdle.ts`: PDF·ZIP·동영상의 공통 2.4초 숨김 타이머와 조작 이벤트 처리. 키보드 모드 기본값은 모든 키 입력이며 PDF·ZIP의 공통 overlay는 Tab·컨텍스트 메뉴 접근 키만 표시하는 모드를 사용합니다. 뷰어 루트의 `viewer-idle`로 커서를 숨기고 툴바의 `inert`로 숨긴 조작 영역을 비활성화합니다.
- `src/routes/viewerPages.ts`: 뷰어 route lazy loading과 idle preload 진입점
- `src/pages/LibraryPage.tsx`: 메인 라이브러리 화면
- `src/pages/PdfViewerPage.tsx`, `src/pages/CbzViewerPage.tsx`, `src/pages/VideoPlayerPage.tsx`: 포맷별 뷰어 화면
- `src/useCbzPages.ts`, `src/cbzPageCache.ts`: ZIP 바이너리의 Blob URL과 decode, 앞뒤 한 화면의 순차 미리 읽기, 추정 이미지 예산 128MiB, 오래된 결과 폐기와 URL 해제를 처리합니다. ZIP IPC는 `open/getPage/close` 세션 API를 사용합니다.
- `src/components/`: 공용 UI 조각
- `src/components/PasteInput.tsx`: 상세보기 텍스트 입력과 입력란 내부 SVG 붙여넣기 버튼, 전체 텍스트 교체와 포커스 복원을 처리합니다.
- `src/components/Library/`: 라이브러리 화면 전용 툴바, 목록, 카드, 모달, hook
- `src/components/ItemDetail/`: 항목 조회·편집·태그·리뷰·파일 처리 hook, 프로필 이동·복사 hook, 확인/오류 팝업과 표시 형식 함수
- `src/components/Toast.tsx`: 뷰어와 라이브러리의 알림 상태·표시·종료 타이머. 호출부가 위치·성공/오류 스타일을 지정하고 기본 뷰어 스타일을 유지합니다.
- `useLibraryMetadataFill`은 최초 목록과 신규 데이터 추가 신호에서 페이지 수·재생 시간을 보완합니다. 진행 중 Queue는 완료를 기다린 후 신규 항목을 재수집하고, 완료 시 변경이 있으면 최신 검색 조건으로 목록을 한 번 갱신합니다. polling 수명은 목록 건수나 조회 콜백 변경과 분리합니다.
- `src/components/icons/`: 뷰어와 라이브러리에서 공유하는 SVG 아이콘 컴포넌트
- `src/i18n/`: 다국어 리소스

## 런타임 흐름

### 콘텐츠 분류와 파일 타입

- `items.contentType`은 사용자가 지정하는 도서/만화책/동영상/기타 분류이며 검색 조건에도 사용합니다.
- `items.containerType`은 확장자 기반 파일 타입(`pdf`/`zip`/`video`/`other`)입니다. 상세정보에서는 읽기 전용으로 표시합니다.
- 뷰어 경로는 `components/Library/mediaLabels.ts`의 `getViewerPath`로 결정하고, 진행률 단위와 플레이리스트 등록 조건도 파일 타입을 사용합니다.
- 일반 등록과 HDT 가져오기는 PDF/ZIP을 도서, 동영상을 동영상으로 기본 분류합니다. 기존 데이터와 과거 DB 가져오기는 저장된 콘텐츠 분류를 보존합니다.
- 파일 재연결에서는 새 확장자로 파일 타입을 다시 산정하며 콘텐츠 분류는 바꾸지 않습니다.

### 앱 시작 순서

1. Electron 앱 시작
2. 포터블 경로 및 userData/sessionData 경로 설정
3. startup 상태 IPC 등록
4. 브라우저 창 조기 표시 및 startup 화면 로드
5. SQLite DB 열기 및 마이그레이션 실행
6. IPC 핸들러 등록
7. startup ready 이벤트 전송
8. 렌더러의 `ProfileGate`가 active profile 상태를 확인하고, 필요하면 프로필 선택/생성 화면을 표시
9. 프로필 선택 완료 후 라이브러리 화면 mount 및 `window.api`를 통한 최초 목록 조회
10. 최초 라이브러리 목록 표시 시점에 `library:list-ready` 로그 기록
11. 썸네일 로드와 뷰어 route preload는 목록 표시 이후 비동기로 진행

## PDF·ZIP 표시 방식과 스크롤

- `items.bookViewMode`, `bookScrollZoom`, `bookScrollOffset`는 항목별 표시 방식·스크롤 배율·페이지 내 위치 비율을 저장합니다. `ensureRuntimeSchema`가 기존 DB에 nullable 컬럼을 추가하고 프로필 재구축·항목 이동/복사·과거 DB 가져오기도 보존합니다.
- `useBookViewerViewMode`는 저장값을 적용하며 스크롤 전용 배율 버튼으로 50~300%를 지정합니다. 배율을 변경할 때 표시 방식과 같은 항목에 저장합니다.
- `bookScrollModel`은 이미지 크기와 표시 폭에서 페이지 높이·누적 시작 위치를 계산하고 스크롤 좌표를 페이지 번호·페이지 내 비율로 변환합니다.
- `BookScrollView`는 읽기 화면과 주변 화면의 요소만 실제 위치에 배치합니다. 페이지 간 여백과 최소 화면 높이를 두지 않습니다. 페이지 이동은 명시적인 요청에만 위치를 대입하고, 스크롤로 현재 페이지가 바뀔 때는 애니메이션을 유지합니다. 크기·배율 변경 시 저장한 페이지 내 비율로 위치를 보정합니다.
- `useBookScrollPosition`은 180ms debounce 저장과 종료·전환 시 flush를 관리합니다. 복원이 끝나고 페이지 크기가 확인된 위치만 저장합니다.
- `PdfScrollPage`는 요청한 폭으로 canvas를 표시하며 큰 페이지는 16M pixel/한 변 32767px 안에서 렌더 배율을 줄입니다. 해제 시 작업을 취소하고 PDF 문서는 뷰어 종료 시 파기합니다.
- `useCbzPages`는 이미지 decode 시 자연 크기를 기록하며 화면에 걸치는 페이지 수를 기준으로 캐시를 요청합니다. 기존 세션·Blob URL·128MiB 추정 예산을 재사용합니다.

## 공용 툴팁

- `src/renderer/src/components/Tooltip`은 호버·포커스 표시, Escape 닫기, 가장 가까운 컨테이너의 경계와 오른쪽 넘침 보정을 관리합니다.
- 컨테이너는 `.tooltip-container`와 `data-tooltip-boundary`로 지정합니다. 기본 폭은 240px이며 경계는 콘텐츠·패딩·테두리 영역 중 선택합니다.
- 상세보기 언어 안내는 메타데이터 전체의 콘텐츠 경계를 기준으로 표시합니다. 세부 기준과 사용 예는 [툴팁 기준](tooltip-guidelines.md)을 따릅니다.

## Startup 흐름

- `src/main/index.ts`는 startup 단계별 상태를 저장하고 renderer에 `startup:status`, `startup:ready` 이벤트로 전달합니다.
- 각 단계는 `performance.now()` 기준으로 소요 시간을 console에 남깁니다.
- `src/preload/index.ts`는 `window.api.startup` 아래에 `getStatus`, `markLibraryReady`, `onStatus`, `onReady`를 노출합니다.
- `src/renderer/src/components/Startup/StartupGate.tsx`는 ready 전까지 startup 화면을 보여주며, ready 이후에만 프로필 gate와 라우터·라이브러리 화면을 mount합니다.
- 현재 단계는 창 생성, DB 열기, 마이그레이션, 런타임 스키마 확인, IPC 등록입니다.
- 앱 창은 `ready-to-show`를 기다리지 않고 먼저 표시합니다.
- 최초 라이브러리 목록이 준비되면 renderer가 `startup:markLibraryReady`를 호출하고, main process는 `[startup] library:list-ready ...ms` 로그를 남깁니다.
- 준비 완료 기준은 startup ready 이벤트가 아니라 최초 라이브러리 목록 표시 시점입니다.

## 과거 DB 가져오기

- 앱 시작 시 과거 userData 위치의 `media-library.db`를 자동 복사하지 않습니다.
- 설정 팝업의 `과거 데이터 불러오기`에서 사용자가 직접 기존 `media-library.db`를 선택합니다.
- 설정 팝업 내 진입 UI는 숨김 `input:file`, 파일명을 표시하는 readonly text input, `불러오기` 버튼으로 구성합니다.
- `src/main/ipc/legacyDatabase.ts`는 선택한 DB를 읽기 전용으로 열어 `items` 테이블과 주요 컬럼을 확인하고, 중복/제외 항목 통계를 미리보기로 반환합니다.
- 미리보기 Modal은 720px 폭의 `프로필 관리`, `설정`, `태그`, `파일 정보` 아코디언으로 구성하며 대상 프로필을 표시합니다. 미리보기는 DB를 변경하지 않고, 파일 항목이 없어도 프로필·설정을 가져올 수 있습니다.
- 가져오기 적용 시 `profiles`를 이름으로 연결하거나 생성하고, 중복되지 않은 `items`와 연결 가능한 `tags`, `itemTags`, `reviews`, `settings`, `playlists`, `playlistItems`를 현재 DB id 기준으로 매핑합니다. 프로필 생성부터 태그 정리까지 하나의 transaction으로 처리합니다.
- 원본 사용자 프로필의 소속을 복원합니다. GUEST는 GUEST에 연결하고, 프로필 정보가 없는 행과 UNASSIGNED는 현재 프로필에 등록합니다. 존재하지 않는 사용자 프로필 참조는 오류로 처리합니다. 태그·플레이리스트의 연결이 다른 프로필의 항목으로 이어지지 않도록 검사합니다.
- 기존 설정값은 같은 프로필 범위에 같은 key가 없을 때만 가져옵니다. 단, `SYSTEM` 설정 키는 `SYSTEM` 프로필 기준으로 처리합니다.
- `playlist.activeId`, `profile.lastActiveId`, `profile.lastActiveIds`는 새 ID로 치환합니다. 현재 스키마의 모든 항목 필드를 가져오며 원본에 없는 필드는 지정된 기본값 또는 NULL을 사용합니다. 기존 빈 문자열과 실제 파일 경로·파일명은 보존합니다.
- 가져오기에서 매핑한 태그 중 실제로 사용되지 않는 태그만 transaction 안에서 정리합니다.

## Renderer Route Loading

- 라이브러리 화면은 초기 route에 포함합니다.
- PDF, CBZ, 비디오 뷰어 route는 `React.lazy`로 분리해 첫 라이브러리 화면 로드에 함께 묶이지 않도록 합니다.
- 최초 라이브러리 목록 표시 이후 idle 시점에 뷰어 route를 미리 import합니다.

## 핵심 도메인

- `profiles`: 시스템/사용자 프로필
- `items`: 라이브러리의 기본 엔터티
- `tags`: 태그 마스터
- `itemTags`: 아이템-태그 매핑
- `reviews`: 별점/코멘트
- `settings`: 간단한 키-값 설정
- `playlists`: 프로필별 복수 플레이리스트
- `playlistItems`: 플레이리스트 항목과 표시 순서

## 프로필 구조

- `profiles.id`는 `SYSTEM = 1`, `UNASSIGNED = 2`, `GUEST = 3`, 사용자 생성 프로필은 `4`부터 사용합니다.
- `items`, `tags`, `playlists`, `settings`는 `profileId`를 직접 가집니다.
- `itemTags`, `playlistItems`, `reviews`는 각각 상위 테이블 관계에 귀속되며 별도 `profileId`를 두지 않습니다.
- `src/main/services/profileState.ts`는 현재 실행 중인 active profile id를 메모리에서 관리합니다.
- `src/main/ipc/profiles.ts`는 프로필 선택, 생성, 이름 변경, 선택 해제, 삭제, 삭제 전 summary 조회를 담당합니다.
- `src/main/ipc/items/profileMove.ts`는 항목 단위 프로필 이동/복사와 대상 프로필 목록 조회를 담당합니다.
- `profile.lastActiveIds`는 `SYSTEM` 설정으로 저장하며, 최근 사용 프로필을 최대 2개 보존합니다. 삭제된 프로필은 직전 프로필 또는 `GUEST`로 fallback합니다.
- `profile.useLastOnStartup`이 `true`이면 앱 실행 시 마지막 유효 프로필로 자동 진입합니다.
- UI 언어·동영상 볼륨·파일 수정일 정책·최근 프로필·자동 진입 설정은 SYSTEM에 저장하고 나머지 사용자 설정은 active profile에 저장합니다. SYSTEM 키 구분은 `src/main/ipc/settings.ts`를 기준으로 합니다.
- 프로필 삭제 시 해당 프로필의 플레이리스트는 삭제하고, `reviews`, `itemTags`, `playlistItems`는 명시적으로 정리합니다.
- 항목 이동/복사와 프로필 삭제 이관은 태그명을 기준으로 대상 프로필의 태그를 재사용하거나 새로 생성합니다.
- 과거 DB 가져오기는 가져온 항목/태그/플레이리스트를 현재 active profile에 귀속합니다.

## 태그 유지보수

- `src/main/services/tagRename.ts`는 프로필 범위의 이름 변경·병합을 하나의 transaction으로 수행합니다. `tags:rename` IPC는 현재 프로필을 검증하고 유지할 id와 삭제한 id를 반환합니다.
- `TagRenameSection.tsx`는 설정 팝업에서 현재 프로필의 태그를 선택해 변경·병합합니다. `LibraryPage`는 반환된 id로 선택 태그 조건을 치환한 뒤 목록과 태그 건수를 다시 조회합니다.

- `src/main/services/tagMaintenance.ts`의 `cleanupUnusedTags`는 `itemTags`에 연결되지 않은 태그를 삭제합니다.
- 사용 건수는 해당 태그가 몇 개의 아이템에 연결되어 있는지로 판단하며, 0건이면 미사용 태그입니다.
- 앱 시작, 라이브러리 목록 로드, 태그 연결/해제, 아이템 삭제 후 호출합니다.
- `getTagUsageCounts`는 사용 중인 태그만 `{ id, name, count }` 형식으로 반환하며, 건수 내림차순과 이름 오름차순으로 정렬합니다.
- `items:getAll`은 `tagIds`를 받으면 선택된 모든 태그가 연결된 아이템만 반환하는 AND 필터를 적용합니다.
- `items:getAll`은 `untagged`를 받으면 태그가 하나도 연결되지 않은 아이템만 반환합니다.
- 검색 조건 모달은 선택 태그 한 줄 목록과 기존 등록 목록 사이에 공용 `TagSearchInput`과 선택 버튼을 표시합니다. 이미 선택한 태그와 다른 프로필의 태그는 검색 후보에서 제외합니다.

## 콘텐츠 언어와 검색 조건

- `items.language`는 `unspecified`를 기본값으로 사용합니다. 상세정보와 검색 조건에서 `미지정`으로 표시하고 라이브러리 카드에는 언어 배지를 표시하지 않습니다.
- `items.language = 'none'`은 대사 등이 없는 콘텐츠를 뜻하며, 카드에 `N/A` 배지를 표시합니다. `ko`, `ja`, `en`, `zh`, `other`는 기존 지정 언어 값을 유지합니다.
- 기존 빈 언어값은 DB migration과 runtime schema 점검에서 `unspecified`로 변환합니다. HDT와 과거 DB 가져오기에서 값이 비어 있는 경우도 `unspecified`를 사용합니다.
- `items:getAll`의 `language`가 생략되거나 빈 문자열이면 전체 언어를 조회하며, 지정 값은 그대로 `items.language`와 비교합니다.
- 현재 값이 `unspecified`가 아니면 renderer의 언어 선택과 `items:update` IPC 모두 `unspecified`로의 변경을 막습니다.

## 주의할 코드 영역

### `src/main/ipc/items/`

- 아이템 관련 IPC 등록 폴더입니다.
- renderer/preload의 `api.items.*` 호출명은 유지하고, main 내부 책임만 세부 파일로 나눕니다.
- `index.ts`: 아이템 IPC 등록 진입점
- `core.ts`: 목록 조회, 상세 조회, 추가, 수정, 삭제, 중복 확인
- `relink.ts`: 개별 relink, 폴더 prefix count, bulk relink
- `imports.ts`: `.hdt` preview/apply. 미리보기 캐시에 준비한 `profileId`를 저장하고 다른 프로필에서 적용하면 폐기·거절합니다.
- `relink.ts`는 개별·폴더 일괄 경로 변경 전 충돌을 검사하고 충돌 시 기존 항목·연결 데이터를 보존합니다.
- `metadata.ts`: 누락 메타데이터 보강과 상태 조회
- `profileMove.ts`: 항목 프로필 이동/복사, 대상 프로필 조회
- `utils.ts`: 경로 비교, full path 구성, HDT 보조 타입과 이미지 디코딩
- 목록 조회 응답은 라이브러리 카드와 컨텍스트 메뉴에서 필요한 `sourceUrl` 같은 표시/액션 필드를 포함합니다.
- 목록 검색어는 제목, 파일명, 작가, 메모, 원본 URL을 대상으로 합니다.

### `src/main/ipc/playlists.ts`

- 프로필별 목록·건수 조회, 생성·이름 변경·삭제·선택과 목록 id별 항목 추가·제거·초기화·순서 변경을 담당합니다. 명시된 id가 다른 프로필이거나 삭제되었으면 기본 목록으로 바꾸지 않고 읽기는 빈 목록, 변경은 실패로 처리합니다.
- `services/playlistSelection.ts`가 `playlist.activeId` 저장·복원과 유효성 보정을 관리합니다. 목록이 없을 때만 `Default`를 생성하며 기존 목록의 이름 변경·삭제 후에는 다시 만들지 않습니다.
- `getItemPlaylistIds`는 현재 프로필에서 지정 항목이 등록된 목록 id만 조회합니다. 라이브러리 우클릭 메뉴는 목록 전체 항목이나 썸네일을 읽지 않고 이 결과로 등록 체크를 표시합니다.
- 항목 추가 시 target position을 받을 수 있습니다. 이미 포함된 항목의 일반 추가는 순서를 유지하고, 위치를 지정한 drop은 해당 위치로 이동합니다.
- 항목 응답에는 뷰어와 패널에서 즉시 사용할 수 있도록 `thumbnailBase64`를 포함합니다.
- `.db` 가져오기는 `playlist.activeId`를 다른 일반 설정처럼 그대로 복사하지 않고 목록 id 매핑 후 처리합니다. 대상 프로필에 이미 선택값이 있으면 유지합니다.

### `src/renderer/src/pages/LibraryPage.tsx`

- 메인 라이브러리 화면의 조립과 상세보기·플레이리스트 포커스 연결을 담당합니다.
- `useLibraryItems`가 목록 조회, 항목 저장 응답 반영, 뷰어 복귀의 조건부 재조회, 최초 준비 알림·idle preload와 metadata fill 연결을 관리합니다.
- `useLibraryProfileTransfer`가 이동·복사 요청과 결과 알림을 처리합니다. 이동 성공 시 목록·플레이리스트를 함께 갱신합니다.
- 검색/필터 툴바, 카드, 목록/페이지네이션, 주요 모달 렌더링은 `src/renderer/src/components/Library/` 아래로 분리되었습니다.
- 파일 추가·`.hdt` 가져오기·설정/bulk relink는 전용 hook에서 처리합니다. `useFileImport`는 화면 이탈 후 남은 요청·갱신을 중단하고, `useHdtImport`는 취소·화면 이탈 이전 요청의 늦은 응답을 무시합니다.
- `.hdt` 가져오기 진입점은 설정 팝업의 `HDT 가져오기` 항목입니다.
- 검색/필터 상태는 `useLibrarySearchFilters` hook으로 분리되었습니다.
- 썸네일 로드는 `useLibraryThumbnails` hook으로 분리되었습니다.
- metadata fill 흐름은 `useLibraryMetadataFill` hook으로 분리되었습니다.

### `src/renderer/src/components/Library/LibraryGrid.tsx`

- 라이브러리 썸네일 목록, 카드 컨텍스트 메뉴, 하단 페이지네이션을 담당합니다.
- 목록 카운터 위에 현재 검색 조건 요약을 표시합니다.
- 검색 조건 요약은 조건별 inline-block 항목으로 렌더링해 좁은 폭에서도 조건 단위로 줄바꿈합니다.
- 목록은 단일 Tab 진입 영역이며, 썸네일 간 이동은 현재 그리드 폭으로 계산한 방향키 roving focus를 사용합니다.
- 썸네일 목록은 고정 카드 폭 기반 CSS grid로 배치해 각 줄의 칼럼 간격을 유지하고, 마지막 줄도 왼쪽부터 같은 칼럼 간격으로 표시합니다.
- 상세 팝업 종료 후 focus request를 받아 다시 목록으로 포커스를 복귀시킵니다.
- 카드 컨텍스트 메뉴는 공용 `ContextMenu`를 사용하며, `Escape`로 닫으면 현재 active 카드로 포커스를 명시적으로 복귀시킵니다.
- 페이지네이션은 이전/다음 caret 버튼과 최대 9개 범위의 페이지 번호 버튼을 표시합니다.

### `src/renderer/src/components/Library/PlaylistPanel.tsx`

- 라이브러리와 뷰어에서 공유하는 플레이리스트 패널입니다.
- `viewerMode`에서는 제거 버튼·순서 변경/제거 메뉴를 비활성화하고 편집 함수·pointer drag·외부 drop을 차단합니다. 목록이 처리한 키 입력은 전파를 중단해 뷰어의 페이지 이동과 중복 실행되지 않습니다.
- `PlaylistManager.tsx`가 라이브러리 전용 목록 선택·관리 Modal을 표시하며 `hooks/useLibraryPlaylists.ts`가 목록 상태·항목의 함께 갱신과 오래된 응답 폐기를 처리합니다.
- 뷰어의 `useViewerPlaylist`는 진입 시 목록 id를 보관합니다. 라우트 state의 `playlistId`와 함께 타입 간 이동·자동 이어보기에 전달하며, 선택값을 매번 다시 읽지 않습니다.
- 라이브러리 화면에서는 좌/우 표시 설정을 지원하되, HTML 순서는 툴바 다음, 라이브러리 본문 이전으로 유지합니다.
- 항목 클릭으로 뷰어를 열고, 라이브러리에서 항목별 제거와 전체 초기화를 제공합니다.
- 목록은 단일 Tab 진입 영역이며, 위/아래 방향키로 active 항목을 이동하고 라이브러리에서 `Delete` 키로 active 항목을 제거합니다.
- 항목 제거 버튼은 Tab 순서에서 제외합니다. 삭제 후 남은 인접 항목에 포커스를 이어가고, 빈 목록은 컨테이너에 둡니다.
- 항목 컨텍스트 메뉴는 공용 `ContextMenu`를 사용하며 재생, 한 칸 위/아래 이동, 상세정보 확인, 목록에서 제거 액션과 단축키 표기를 제공합니다.
- 라이브러리 플레이리스트 항목은 pointer 기반 drag and drop으로 재정렬하며, 삽입 위치 placeholder를 표시합니다.
- 라이브러리 카드 drag and drop으로 플레이리스트에 항목을 추가할 때도 표시된 위치에 삽입합니다.

### `src/renderer/src/components/ContextMenu/index.tsx`

- 라이브러리 카드, 플레이리스트 항목, 뷰어 메뉴에서 공유하는 컨텍스트 메뉴입니다.
- 메뉴 바깥 클릭과 전역 `Escape` 닫기를 처리하고, 호출 컴포넌트가 닫힘 사유에 따라 포커스 복귀 여부를 결정할 수 있도록 `onClose`에 reason을 전달합니다.
- 하위 메뉴는 호출한 상위 항목 위치와 실제 메뉴 크기를 기준으로 배치하며, 오른쪽 공간이 부족하면 왼쪽으로 열어 상위 메뉴를 덮지 않도록 합니다.

### `src/renderer/src/components/ChoiceInput.tsx`

- 체크박스와 라디오 버튼의 custom input 스타일을 공유하는 공용 컴포넌트입니다.
- profile 선택 화면, 프로필 삭제 Modal, 설정 팝업 등에서 동일한 체크/라디오 스타일을 사용합니다.

### `src/renderer/src/components/Dropdown.tsx`

- native `select`를 대체하는 공용 드롭다운입니다.
- Tab 포커스 진입/탈출, 위/아래 방향키 option 이동, Enter/Space 선택, Escape 닫기를 지원합니다.
- disabled option은 클릭하거나 키보드로 접근해도 선택되지 않으며, 클릭으로 드롭다운이 닫히지 않습니다.

### `src/renderer/src/components/TagSearchInput.tsx`

- 상세 정보 태그 추가와 검색 조건 태그 선택에 사용하는 검색형 입력 컴포넌트입니다.
- 현재 프로필에서 실제 사용 중인 태그 후보만 받아 필터링하고, 입력란에서 위/아래 방향키로 active option을 이동한 뒤 Enter로 등록합니다.
- `showTagId` 옵션은 기본값 `false`이며, 활성화하면 후보에 `#id`를 표시하고 id 검색도 허용합니다. `disabled` 옵션으로 처리 중 입력과 후보 선택을 막습니다. 태그명 변경·병합은 변경 전·후 입력 모두 같은 컴포넌트를 사용합니다.
- `closeOnCommit` 기본값은 `false`이며 태그명 변경·병합에서 활성화해 선택 직후 목록을 닫습니다. `clearLabel`을 전달하면 입력 내부에 원형 X 버튼을 표시합니다. 비우기는 `onChange('')`로 호출부의 선택 상태도 정리하고, 입력 포커스를 유지한 채 목록을 닫습니다. blur는 입력 그룹 밖으로 포커스가 이동할 때 목록을 닫습니다.
- `maxOptions` 기본값은 20이며, `countSort`는 `asc`/`desc`로 데이터 수를 정렬합니다. 정렬 생략 시 전달된 순서를 유지합니다. 검색 후 정렬하고 최대 건수를 적용하며, 데이터 수가 없는 후보는 0건으로 취급합니다. 동률은 이름·id 순서입니다.
- 태그명 변경·병합의 두 입력은 최대 50건을 표시하고, 변경 전은 오름차순·변경 후는 내림차순으로 정렬합니다. 변경 후를 먼저 입력할 수 있습니다.
- 옵션 목록은 포커스 가능한 버튼이 아니라 `aria-activedescendant` 기반 listbox로 렌더링해, Tab/Shift+Tab이 입력란 주변 컨트롤로 이동하도록 유지합니다.

### `src/renderer/src/components/Library/LibraryToolbar.tsx`

- 검색 조건 모달 진입, 검색 조건 초기화, 파일 추가, 새로고침, 설정 액션을 담당합니다.
- 검색 버튼은 `SearchIcon`, 텍스트, 플랫폼별 단축키 표기를 함께 보여줍니다.
- 새로고침, 설정은 문자열 임시 버튼 대신 SVG 아이콘 버튼을 사용합니다.
- 아이콘 버튼은 시각 텍스트 대신 `title`과 `aria-label`로 의미를 제공합니다.

### `src/renderer/src/components/Library/modals/SearchFiltersModal.tsx`

- 검색어, 타입, 언어, 진행 상태, 파일 상태, 정렬 방식, 정렬 방향, 태그 조건을 한곳에서 지정합니다.
- 태그 조건은 전체, 미지정, 선택 태그 AND 필터 중 하나의 흐름으로 동작합니다.
- 등록 태그는 사용 건수 순서로 전체 목록을 표시하며, 최대 180px 높이의 목록 내부에서 세로 스크롤합니다. 목록 끝에서 스크롤해도 부모 본문으로 스크롤을 전달하지 않습니다.
- 검색 조건 팝업은 내용에 맞게 높이를 정하고 화면 높이를 넘지 않도록 제한합니다.
- 선택 태그 행은 48px 고정 높이이며 가로 스크롤바를 항상 표시합니다.
- 태그 초기화 버튼은 header 오른쪽에 항상 표시하고, 태그 조건이 없으면 비활성화합니다.
- 정렬 방향은 select가 아니라 아이콘과 문구가 있는 토글 버튼으로 전환합니다.

### `src/renderer/src/pages/ItemDetailPage.tsx`

- 상세 정보 본문과 뷰어 진입을 구성합니다. `components/ItemDetail/useItemDetail.ts`가 조회·편집 저장·태그·리뷰·삭제·relink 상태와 요청을 처리하며, 항목과 편집 폼은 명시적 타입을 사용합니다.
- `useItemProfileTransfer.ts`는 대상 프로필 조회와 이동·복사를 관리하고, `ItemDetailDialogs.tsx`는 리뷰·relink 확인/오류·삭제 팝업을 공용 Modal로 표시합니다.
- `formatters.ts`는 진행률과 OS별 표시 경로를 구성합니다. UI의 번역 함수 타입은 공용 `i18n/index.ts`의 `Translate`를 사용합니다.
- 파일 경로 표시는 OS별 구분자로 정규화합니다. Windows는 `\`, 그 외 OS는 `/`를 사용합니다.
- 파일 섹션 제목 오른쪽에는 `파일 위치 열기` 버튼을 표시하고 `api.file.showInFolder`로 연결합니다.
- 리뷰와 파일 사이에는 프로필 이동 항목이 있으며, 컨텍스트 메뉴와 같은 기준의 대상 프로필 select로 항목 이동/복사를 실행합니다.

### `src/renderer/src/components/Library/modals/SettingsModal.tsx`

- 검색 조건 모달과 같은 고정 header/body/footer 구조를 사용합니다.
- 프로필 관리, 표시 설정, 파일 수정일 변경 규칙, `HDT 가져오기`, 폴더 경로 일괄 변경, 태그명 변경·병합, 과거 데이터 불러오기 섹션으로 구분합니다.
- `HDT 가져오기`와 과거 데이터 불러오기는 숨김 파일 입력, readonly text input, `불러오기` 버튼 패턴을 사용합니다.
- 폴더 경로 일괄 변경의 대상 항목 수와 실행 버튼은 같은 행에 표시합니다.
- 배율 컨트롤은 `app:getZoomFactor`, `app:zoomIn`, `app:zoomOut`, `app:zoomReset`을 사용해 현재 배율 표시를 즉시 갱신합니다.
- 개발자 도구는 `CodeIcon` 아이콘 버튼으로 제공합니다.
- 프로필 관리 탭은 현재 프로필 확인·사용자 프로필 이름 변경·과거 DB 가져오기를 제공합니다. 프로필 선택 화면으로 돌아가는 전환 버튼은 footer에 있습니다.
- 팝업 폭은 720px, 최대 높이는 860px이며, 모든 화면 폭에서 상단 탭으로 카테고리를 전환합니다. 탭 순서는 기본 설정(표시·파일 수정일 정책), 데이터 관리(태그명 변경·병합·bulk relink·HDT), 프로필 관리(프로필명 변경·과거 DB)입니다. 팝업을 닫으면 선택 탭을 `기본 설정`으로 초기화합니다. body의 `scrollbar-gutter: stable both-edges`로 좌우에 같은 공간을 확보해 설정 그룹을 가운데에 배치합니다.

### `src/renderer/src/components/Modal/index.tsx`

- 공용 모달 래퍼입니다.
- `role="dialog"`, `aria-modal`, focus trap, `Escape` 닫기를 제공합니다.
- 닫힌 동안 외부 포커스를 기억해 자동 포커스 입력란·일시 비활성화 버튼에도 복귀 대상을 유지합니다. 닫을 때 지연 포커스를 취소하고 `preventScroll`로 복원합니다.
- 중첩 Modal의 표시 순서를 조정할 수 있도록 선택적 `zIndex`를 받을 수 있습니다.

## 테스트 구성

- `tests/unit/`: 캐시·자원 해제·비동기 응답 경합·Modal 포커스·알림 타이머 등 로직과 UI hook 테스트
- `tests/integration/`: 메모리 SQLite 기반 프로필·태그·플레이리스트·HDT·relink·과거 DB 가져오기와 데이터 보존 테스트
- `tests/e2e/app.spec.ts`: 임시 폴더에서 Electron을 실행하는 실제 화면·뷰어·프로필·파일 처리·키보드 회귀 테스트
- `scripts/run-tests.js`는 Electron의 Node 실행 모드로 Vitest를 구동합니다. `playwright.config.ts`는 E2E를 worker 1개로 실행합니다.
- E2E의 OS 파일 선택·외부 URL 응답은 필요한 시나리오에서 대체합니다. 실제 사용자 데이터는 사용하지 않습니다.
- 최신 검증일·건수·결과는 [Current Status](current-status.md#최신-구현-검증), 실행 명령은 [Setup](setup.md#검사와-빌드)에서 관리합니다.
