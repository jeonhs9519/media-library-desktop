# Current Status

Last updated: 2026-04-29

`media-library-desktop`는 Electron + React + SQLite 기반의 개인용 미디어 라이브러리 앱입니다. PDF, CBZ, 비디오 파일을 등록하고, 썸네일, 진행률, 태그, 리뷰, 다국어 UI를 함께 관리하는 방향으로 구현되어 있습니다.

## 현재 구현 상태

- Electron 메인 프로세스와 React 렌더러가 분리되어 있습니다.
- SQLite 데이터베이스는 `better-sqlite3` + `drizzle-orm` 조합으로 관리합니다.
- 라이브러리 목록에서 검색, 정렬, 페이지네이션, 파일 존재 여부 확인이 가능합니다.
- PDF, CBZ, 비디오에 대해 각기 다른 뷰어 화면이 연결되어 있습니다.
- 상세 정보 모달에서 태그, 리뷰, 진행률, 파일 열기 등의 관리 흐름이 있습니다.
- 썸네일 생성/저장 기능이 있으며, CBZ 자동 썸네일과 사용자 지정 썸네일 일부가 구현되어 있습니다.
- `.hdt` 가져오기 미리보기/선택 적용 기능이 있습니다.
- 파일 경로 변경을 위한 개별 relink와 폴더 단위 bulk relink가 있습니다.
- 다국어 리소스는 `en`, `ko`, `ja`, `zh`를 사용합니다.

## 현재 구조 요약

- 메인 엔트리: `src/main/index.ts`
- 프리로드 브리지: `src/preload/index.ts`
- 렌더러 앱 엔트리: `src/renderer/src/App.tsx`
- 메인 화면 허브: `src/renderer/src/pages/LibraryPage.tsx`
- DB 스키마: `src/main/db/schema.ts`
- 핵심 IPC: `src/main/ipc/items.ts`

## 현재 강점

- 단일 앱으로 필요한 기능이 꽤 많이 묶여 있습니다.
- 메인/렌더러/프리로드 경계가 비교적 명확합니다.
- 포터블 실행을 고려한 데이터 경로 처리와 레거시 DB 마이그레이션이 들어가 있습니다.
- 기능 추가 흔적이 문서와 TODO로 남아 있어 다음 작업을 이어가기 쉽습니다.

## 현재 한계와 리스크

- `LibraryPage.tsx`가 매우 커서 UI 상태와 동작이 한 파일에 집중되어 있습니다.
- 테스트는 현재 얇은 편이며, 핵심 사용자 흐름을 충분히 보호하지 못합니다.
- 루트 문서가 분산되어 있었고, 작업 기록이 구조적으로 누적되지는 않았습니다.
- `items` IPC가 커지고 있어 이후 기능 추가 시 책임 분리가 필요할 수 있습니다.

## 작업 트리 메모

- 현재 수정 중인 파일이 이미 존재합니다.
- 확인된 변경 파일:
  - `scripts/after-pack.js`
  - `src/main/index.ts`

이 문서는 기능 상태 중심으로 유지하고, 세부 구현 계획은 `next-task.md`와 `backlog.md`에서 관리합니다.
