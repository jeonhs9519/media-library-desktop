# Changelog

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
- 다음 작업 우선순위를 startup 확인, 태그 필터링, 테스트 보강, 플레이리스트 범위 확정 순서로 재정리

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
