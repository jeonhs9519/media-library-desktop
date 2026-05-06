# media-library-desktop

로컬 PDF, CBZ, 비디오 파일을 SQLite 기반으로 관리하는 Electron 데스크톱 앱입니다. 태그, 리뷰, 썸네일, 진행률, 이어보기 흐름을 함께 다룹니다.

`v0.1.0`은 첫 사용 가능 배포판입니다. 현재 저장소는 공개 저장소로 운영되며, 로컬 DB, 로그, 테스트용 인증서, `.hdt` 샘플 같은 실행 중 생성 파일은 저장소에 포함하지 않습니다.

## 주요 기능

- PDF, CBZ, 비디오 파일 등록과 포맷별 뷰어
- 태그, 리뷰, 진행률, 원본 URL, 썸네일 관리
- 검색어, 파일 타입, 언어, 진행 상태, 파일 존재 여부, 태그 조건 기반 검색
- 기본 플레이리스트 저장, 재정렬, 뷰어 내 이전/다음 항목 이동
- 프로필별 라이브러리 분리, 프로필 전환, 항목 이동/복사
- `.hdt` 가져오기와 기존 `media-library.db` 수동 가져오기
- Windows ZIP 패키징과 태그 기반 GitHub Release 워크플로

## 배포판 사용

1. [GitHub Releases 최신 릴리즈](https://github.com/jeonhs9519/media-library-desktop/releases/latest)에서 Windows ZIP 파일을 다운로드합니다.
2. 원하는 폴더에 압축을 풉니다.
3. `MediaLibrary.exe`를 실행합니다.

앱은 실행 파일과 같은 폴더의 `media-library.db`를 기본 DB로 사용합니다. `userData`, session, logs, crash dumps는 같은 폴더의 `.data/` 아래에 저장합니다.
기존 DB가 있다면 설정 팝업의 `과거 데이터 불러오기`에서 사용자가 직접 선택해 가져옵니다.

## 개발 환경

Node.js 18 이상이 필요합니다. CI와 릴리즈 빌드는 Node.js 22 기준으로 실행합니다.

```bash
npm install
npm run dev
```

## 테스트와 빌드

```bash
npm test
npm run build
```

## 릴리즈

버전별 변경 사항은 [`docs/release-notes/`](./docs/release-notes)에서 확인합니다. 최신 첫 사용 가능 배포판은 [`v0.1.0`](./docs/release-notes/v0.1.0.md)입니다.

## 문서

상세 문서는 [`docs/`](./docs) 아래에서 관리합니다.

- [`docs/current-status.md`](./docs/current-status.md): 현재 구현 상태
- [`docs/next-task.md`](./docs/next-task.md): 다음 작업 우선순위
- [`docs/roadmap.md`](./docs/roadmap.md): 단기/중기 계획
- [`docs/AI_WORKFLOW.md`](./docs/AI_WORKFLOW.md): AI 작업 세션 운영 기준
- [`docs/doc-style-guide.md`](./docs/doc-style-guide.md): 문서 작성 규칙과 commit message 규칙
- [`docs/architecture.md`](./docs/architecture.md): 구조 개요
- [`docs/setup.md`](./docs/setup.md): 실행, 테스트, 트러블슈팅
- [`docs/release-ci.md`](./docs/release-ci.md): 빌드, 패키징, CI, 코드 서명
- [`docs/release-notes/`](./docs/release-notes): 버전별 릴리즈 노트
- [`docs/backlog.md`](./docs/backlog.md): 후보 작업 목록

## 핵심 기술

- Electron
- React
- TypeScript
- better-sqlite3
- drizzle-orm
- electron-vite

## 메모

- 과거 userData 위치의 `media-library.db`는 자동 복사하지 않습니다.
- 배포판 폴더를 옮길 때는 같은 폴더의 `media-library.db`와 `.data/`도 함께 옮깁니다.
- 코드 서명용 실제 인증서는 GitHub Actions secrets 또는 별도 보안 저장소에서 관리합니다.
