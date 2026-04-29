# Changelog

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
