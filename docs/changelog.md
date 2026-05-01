# Changelog

## 2026-05-01

- 프로필 최초 실행, 프로필 관리, 프로필 삭제, 프로필 이관 UX와 데이터 분리 범위를 문서화
- 프로필 기능 도입을 결정하고 데이터 이관, 프로필별 데이터 범위, 프로필 관리 UX 기준을 문서화
- 핵심 사용자 흐름 테스트 보강을 중기 로드맵으로 이동
- 플레이리스트 자동 다음 항목 실행 조건을 `book`/`comic`과 `video` 타입별로 확정하고 `roadmap.md`의 중기 확정 항목에서 제거
- commit message는 특별한 요청이 없는 한 항상 `doc-style-guide.md` 기준으로 작성하도록 `AI_WORKFLOW.md`와 `doc-style-guide.md`에 명시
- `AI_WORKFLOW.md`에 작업 종료 전 문서 점검 체크리스트와 commit message 제안 전 문서 최신성 확인 규칙을 추가
- 페이지네이션을 한 페이지만 존재해도 항상 표시하도록 수정
- 상세 팝업 삭제 확인을 `confirm()` 대신 복구 불가 안내가 포함된 공용 Modal로 구현
- 공용 `Modal`의 중첩 동작을 보강해 최상단 Modal만 `Escape`/`Tab` 키 이벤트를 처리하도록 수정
- PDF, CBZ, 비디오 뷰어의 썸네일 업데이트 완료 알림을 `alert()` 대신 상단 툴바 아래 우측 toast로 표시
- renderer 코드에서 `alert()`, `confirm()`, `prompt()` 호출이 남아 있지 않음을 확인
- `next-task.md`에서 페이지네이션 상시 표시와 상세 삭제 확인 Modal을 완료 항목으로 이동
- 재부팅 직후 stdout/stderr 리다이렉션 방식의 개발 앱 startup 확인 결과를 문서화
- startup ready까지 약 `4410.2ms`가 걸렸고, 주요 소요 구간이 창 생성/renderer 로드임을 기록
- `next-task.md`의 다음 우선순위를 플레이리스트 기능 범위 확정부터 시작하도록 조정
- startup 준비 완료 기준을 최초 라이브러리 목록 표시 시점으로 정리
- 썸네일 로드는 준비 완료 이후 비동기로 유지하고, 뷰어 페이지는 lazy loading과 idle preload 방향으로 정리
- startup 흐름 개선을 `next-task.md`의 다음 우선 작업으로 승격
- 창을 `ready-to-show` 전에 조기 표시하도록 변경
- 라이브러리 목록 첫 로드 완료 시 `[startup] library:list-ready ...ms` 로그를 남기도록 추가
- PDF, CBZ, 비디오 뷰어 route를 `React.lazy`로 분리하고 목록 표시 이후 idle 시점에 preload하도록 변경
- 개선 후 개발 앱 재실행 기준 창 조기 표시 약 `118.2ms`, main startup ready 약 `1260.4ms`, 라이브러리 목록 준비 완료 약 `1433.5ms` 확인
- startup 흐름 개선 완료에 따라 `next-task.md`의 다음 우선순위를 플레이리스트 범위 확정으로 조정
- 플레이리스트 표시 위치, 접힘/펼침, 추가 방식, `other` 타입 차단 UX 결정을 문서화
- 편집/삭제는 상세보기 팝업에서만 수행하고 삭제 확인은 별도 Modal로 구현하기로 문서화
- 뷰어 단축키, 포커스 이동, 주요 `title` 동작 확인 완료 상태를 문서화
- 페이지네이션을 한 페이지만 존재해도 항상 표시하도록 남은 작업에 반영

## 2026-04-30

- 미사용 태그를 삭제하는 `cleanupUnusedTags` 기능 추가
- 앱 시작, 라이브러리 목록 로드, 태그 연결/해제, 아이템 삭제 후 미사용 태그를 정리하도록 연결
- 태그별 사용 건수를 파일 연결 수 기준으로 판단하는 정책을 문서화
- 미사용 태그 정리 기능 단위 테스트 추가
- 라이브러리 상단에 태그 사용 건수 칩 목록과 AND 조건 태그 필터링 추가
- `tags:getUsageCounts`와 `items:getAll`의 `tagIds` 필터를 추가하고 다국어 키를 정리
- 검색 조건을 상단 툴바에서 `검색조건 지정` 모달로 이동하고, 현재 조건 요약 표시 추가
- 태그 `미지정` 검색 조건과 `items:getAll`의 `untagged` 필터 추가
- 검색 조건 모달 정렬 방향을 아이콘+문구 토글 버튼으로 변경
- 설정 모달을 검색 조건 모달과 같은 고정 header/body/footer 구조와 섹션 그룹으로 재정리
- 개발자 도구 버튼을 `CodeIcon` 아이콘 버튼으로 교체
- 검색 조건 요약을 툴바에서 목록 카운터 위로 이동하고 조건별 inline-block 표시로 변경
- 태그 검색 조건 요약을 축약하지 않고 선택된 태그 전체 표시로 변경
- 검색어 대상에 원본 URL을 추가하고 검색어 placeholder에 검색 대상 필드를 표시
- 설정 모달 배율 컨트롤에 현재 배율과 `100%` 초기화 목표를 함께 표시
- 확대/축소 버튼을 사각 외곽선 없는 SVG 아이콘 버튼으로 정리
- 검색 버튼에 돋보기 아이콘과 플랫폼별 `Ctrl + F`/`Cmd + F` 단축키 표시 추가
- 라이브러리 화면 구조 개선 결과를 `docs/current-status.md`, `docs/architecture.md`, `docs/next-task.md`, `docs/backlog.md`에 반영
- `LibraryPage.tsx`에서 분리된 라이브러리 전용 컴포넌트, 모달, hook 구조를 문서화
- 라이브러리 목록의 단일 Tab 진입, 방향키 roving focus, 상세 팝업 focus return, 하단 페이지네이션 동작을 문서화
- 카드 컨텍스트 메뉴의 출처 URL 활성화 조건과 `items:getAll`의 `sourceUrl` 포함 변경을 상태 문서에 반영
- 검색 툴바와 페이지네이션의 SVG 아이콘 버튼, `title`/`aria-label` 적용 상태를 문서화
- 다음 작업 우선순위를 startup 확인, 태그 필터링, 라이브러리 화면 분리, 플레이리스트 범위 확정 순서로 재정리
- 검색/필터 상태를 `useLibrarySearchFilters` hook으로 분리하고 태그 필터 상태를 포함
- 검색 조건 모달 태그 목록을 상위 20개 기본 표시와 더보기/접기 버튼으로 정리
- 검색 조건 모달에 태그 초기화 버튼 복원
- 검색조건 초기화와 태그 초기화 버튼을 항상 표시하고, 적용할 조건이 없으면 비활성화하도록 정리
- 상세 정보 모달에서 `미지정` 같은 예약 태그명 추가 시 태그 입력 행의 고정 오류 배지로 차단
- 태그 필터링 완료 상태와 후속 우선순위를 문서에 반영
- 라이브러리 썸네일 로드를 `useLibraryThumbnails` hook으로 분리
- 누락 메타데이터 보강 흐름을 `useLibraryMetadataFill` hook으로 분리
- `items` IPC를 `src/main/ipc/items/` 폴더의 core/relink/imports/metadata 세부 모듈로 분리하고 기존 `api.items.*` 호출명 유지
- 태그 필터링 후속 작업과 라이브러리 화면 분리 후속 작업을 완료 상태로 문서화

## 2026-04-29

- `docs/` 디렉터리 신설
- 문서 인덱스(`docs/README.md`) 추가
- 상태 문서(`docs/current-status.md`) 추가
- 다음 작업 문서(`docs/next-task.md`) 추가
- 로드맵 문서(`docs/roadmap.md`) 추가
- 아키텍처 문서(`docs/architecture.md`) 추가
- 개발/실행 가이드(`docs/setup.md`) 추가
- 릴리스/CI 문서(`docs/release-ci.md`) 추가
- 백로그 문서(`docs/backlog.md`) 추가
- 의사결정 기록(`docs/decisions.md`) 추가
- AI 작업 운영 문서(`docs/AI_WORKFLOW.md`) 추가
- 문서 스타일 가이드(`docs/doc-style-guide.md`) 추가
- 루트 `README.md`를 간결한 진입 문서로 재작성
- 기존 `README.CI.md`, `TODO.md` 내용을 `docs/`로 이관
- Codex Desktop에서 개발 앱 실행 시 `npm.cmd run dev`를 승인된 방식으로 바로 실행하도록 운영 메모 추가
- 앱 실행 시 창을 먼저 표시하고 startup 상태 화면에서 DB/IPC 준비 단계를 보여주도록 변경
- startup 단계별 `performance.now()` 기반 console 로그 추가
- 개발 앱 실행 정상 동작 확인. 단, 캐시가 따뜻한 상태라 startup 화면은 매우 짧게 지나가 직접 확인이 어려웠음
- `LibraryPage.tsx`에서 검색/필터 툴바, 카드 렌더링, 목록/페이지네이션 렌더링을 `components/Library`로 분리
- 라이브러리 카드 키보드 포커스, `Enter`/`Space` 상세 열기, 우클릭 컨텍스트 메뉴 추가
- 공용 `Modal`에 focus trap과 dialog ARIA 속성 추가
- 파일 업로드, HDT 업로드/미리보기, 상세, 설정, bulk relink 관련 모달 렌더링을 `components/Library/modals`로 분리
- 파일 추가, HDT 가져오기, 설정/bulk relink 상태와 핸들러를 `components/Library/hooks`로 분리
- 라이브러리 페이지네이션을 목록 스크롤 영역 밖 하단 고정 영역으로 이동
- 라이브러리 목록을 단일 Tab 진입 영역으로 만들고, 썸네일 간 이동을 방향키 기반 roving focus로 변경
- 하단 페이지네이션을 페이지 번호 버튼 중심으로 바꾸고 이전/다음 버튼을 좌우 끝에 배치
- 코드/구조 변경 후 개발 앱 동작 확인 시 기존 개발 앱을 종료하고 새로 실행하는 운영 메모 추가
- 라이브러리 검색 툴바의 정렬/새로고침/설정 버튼과 페이지네이션 이전/다음 버튼을 SVG 아이콘 버튼으로 교체
