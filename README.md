# media-library-desktop

로컬 PDF, CBZ, 비디오 파일을 SQLite 기반으로 관리하는 Electron 데스크톱 앱입니다. 태그, 리뷰, 썸네일, 진행률, 이어보기 흐름을 함께 다룹니다.

## 빠른 시작

```bash
npm install
npm run dev
```

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
- [`docs/backlog.md`](./docs/backlog.md): 후보 작업 목록

## 핵심 기술

- Electron
- React
- TypeScript
- better-sqlite3
- drizzle-orm
- electron-vite

## 메모

- DB 파일은 기본적으로 앱 실행 파일과 같은 폴더의 `media-library.db`를 사용합니다.
- 기존 `%APPDATA%/media-library-desktop/media-library.db`가 있으면 첫 실행 시 1회 복사합니다.
