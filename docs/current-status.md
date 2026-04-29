# Current Status

Last updated: 2026-04-30

`media-library-desktop`는 Electron + React + SQLite 기반의 개인용 미디어 라이브러리 앱입니다. PDF, CBZ, 비디오 파일을 등록하고, 썸네일, 진행률, 태그, 리뷰, 다국어 UI를 함께 관리하는 방향으로 구현되어 있습니다.

## 현재 구현 상태

- Electron 메인 프로세스와 React 렌더러가 분리되어 있습니다.
- SQLite 데이터베이스는 `better-sqlite3` + `drizzle-orm` 조합으로 관리합니다.
- 라이브러리 목록에서 검색, 태그 필터, 정렬, 페이지네이션, 파일 존재 여부 확인이 가능합니다.
- 검색 조건은 `검색조건 지정` 모달에서 관리하며, 검색어/타입/언어/진행 상태/파일 상태/정렬/태그 조건을 지정할 수 있습니다.
- 검색어는 제목, 파일명, 작가, 메모, 원본 URL을 대상으로 합니다.
- 목록 카운터 위에는 검색 조건 요약을 표시하며, 조건별로 줄바꿈 가능한 inline-block 항목으로 나눕니다.
- 태그 요약은 선택된 태그 전체를 건수 내림차순 기준으로 표시합니다.
- 설정 모달은 검색 조건 모달과 같은 고정 header/body/footer 구조를 사용하며, 표시 설정/파일 수정일 변경 규칙/폴더 경로 일괄 변경으로 구분됩니다.
- 설정 모달의 배율 컨트롤은 현재 배율과 `100%` 초기화 목표를 함께 표시하며, 확대/축소는 SVG 아이콘 버튼을 사용합니다.
- 라이브러리 검색 툴바의 검색 버튼은 돋보기 아이콘과 플랫폼별 단축키(`Ctrl + F` 또는 `Cmd + F`)를 함께 표시합니다.
- 라이브러리 검색 툴바의 새로고침, 설정 버튼은 SVG 아이콘 버튼으로 정리되어 있으며 `title`/`aria-label`을 함께 제공합니다.
- 라이브러리 목록은 단일 Tab 진입 영역이며, 썸네일 간 이동은 방향키 기반 roving focus로 동작합니다.
- 페이지네이션은 목록 하단 고정 영역에 있으며, 이전/다음 caret 버튼과 최대 9개 범위의 페이지 번호 버튼을 제공합니다.
- PDF, CBZ, 비디오에 대해 각기 다른 뷰어 화면이 연결되어 있습니다.
- 상세 정보 모달에서 태그, 리뷰, 진행률, 파일 열기 등의 관리 흐름이 있습니다.
- 사용 건수가 0인 태그를 정리하는 `cleanupUnusedTags` 기능이 있으며, 앱 시작, 라이브러리 목록 로드, 태그 연결/해제, 아이템 삭제 후 호출됩니다.
- 상세 정보 모달을 닫으면 포커스가 다시 라이브러리 썸네일 목록으로 돌아갑니다.
- 썸네일 생성/저장 기능이 있으며, CBZ 자동 썸네일과 사용자 지정 썸네일 일부가 구현되어 있습니다.
- `.hdt` 가져오기 미리보기/선택 적용 기능이 있습니다.
- 파일 경로 변경을 위한 개별 relink와 폴더 단위 bulk relink가 있습니다.
- 다국어 리소스는 `en`, `ko`, `ja`, `zh`를 사용합니다.
- 앱 시작 시 창을 먼저 표시하고, DB/IPC 준비 상태를 renderer의 startup 화면에 단계별로 표시합니다.
- startup 단계별 로그는 `performance.now()` 기준으로 main process 콘솔에 기록합니다.

## 현재 구조 요약

- 메인 엔트리: `src/main/index.ts`
- 프리로드 브리지: `src/preload/index.ts`
- 렌더러 앱 엔트리: `src/renderer/src/App.tsx`
- 메인 화면 허브: `src/renderer/src/pages/LibraryPage.tsx`
- 라이브러리 렌더링 컴포넌트: `src/renderer/src/components/Library/`
- 라이브러리 모달: `src/renderer/src/components/Library/modals/`
- 라이브러리 전용 hook: `src/renderer/src/components/Library/hooks/`
- 공용 아이콘: `src/renderer/src/components/icons/`
- DB 스키마: `src/main/db/schema.ts`
- 핵심 IPC: `src/main/ipc/items.ts`
- 태그 유지보수 기능: `src/main/services/tagMaintenance.ts`
- 검색 조건 모달: `src/renderer/src/components/Library/modals/SearchFiltersModal.tsx`

## 현재 강점

- 단일 앱으로 필요한 기능이 꽤 많이 묶여 있습니다.
- 메인/렌더러/프리로드 경계가 비교적 명확합니다.
- 포터블 실행을 고려한 데이터 경로 처리와 레거시 DB 마이그레이션이 들어가 있습니다.
- startup 상태 이벤트를 통해 느린 초기 실행 상황을 사용자에게 설명할 수 있습니다.
- 기능 추가 흔적이 문서와 TODO로 남아 있어 다음 작업을 이어가기 쉽습니다.

## 현재 한계와 리스크

- `LibraryPage.tsx`에서 툴바, 카드, 목록, 주요 모달 렌더링과 파일 추가/HDT/설정 흐름 hook이 분리되었습니다.
- 공용 `Modal`에 focus trap과 dialog ARIA 속성을 추가했습니다.
- 라이브러리 카드 컨텍스트 메뉴에서 상세 정보, 뷰어 열기, 외부에서 열기, 출처 URL 열기, 파일 위치 열기를 사용할 수 있습니다.
- `items:getAll` 목록 응답에 `sourceUrl`을 포함해 컨텍스트 메뉴와 상세 팝업의 출처 URL 동작을 맞췄습니다.
- `LibraryPage.tsx`에는 아직 검색 조건 상태, 썸네일 로드, metadata fill 흐름이 남아 있어 추가 분리 여지가 있습니다.
- 테스트는 현재 얇은 편이며, 핵심 사용자 흐름을 충분히 보호하지 못합니다.
- 미사용 태그 정리 기능은 단위 테스트가 추가되었지만, 현재 로컬 `better-sqlite3` 네이티브 모듈 잠금 이슈 때문에 실제 SQLite 통합 테스트 대신 호출 계약 중심으로 검증합니다.
- 루트 문서가 분산되어 있었고, 작업 기록이 구조적으로 누적되지는 않았습니다.
- `items` IPC가 커지고 있어 이후 기능 추가 시 책임 분리가 필요할 수 있습니다.
- startup 화면은 캐시가 따뜻한 상태에서는 매우 짧게 지나가므로, 재부팅 직후 느린 실행 환경에서 다시 확인이 필요합니다.

## 작업 트리 메모

- 현재 수정 중인 파일이 이미 존재합니다.
- 확인된 변경 파일:
  - `docs/AI_WORKFLOW.md`
  - `docs/changelog.md`
  - `docs/setup.md`
  - `scripts/after-pack.js`
  - `src/main/index.ts`
  - `src/main/ipc/items.ts`
  - `src/preload/index.ts`
  - `src/renderer/src/App.tsx`
  - `src/renderer/src/components/Library/`
  - `src/renderer/src/components/Modal/index.tsx`
  - `src/renderer/src/components/icons/actionIcons.tsx`
  - `src/renderer/src/i18n/locales/`
  - `src/renderer/src/styles.css`

이 문서는 기능 상태 중심으로 유지하고, 세부 구현 계획은 `next-task.md`와 `backlog.md`에서 관리합니다.
