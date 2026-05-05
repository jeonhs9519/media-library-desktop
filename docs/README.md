# Media Library Docs

`media-library-desktop` 프로젝트 문서를 한곳에서 관리하는 디렉터리입니다.

이 저장소는 단일 애플리케이션 프로젝트이므로, 별도 문서 저장소처럼 크게 분리하지 않고 다음 문서만 유지합니다.

## 문서 읽기 순서

1. `current-status.md`
2. `next-task.md`
3. `roadmap.md`
4. `AI_WORKFLOW.md`
5. `doc-style-guide.md`
6. `architecture.md`
7. `backlog.md`
8. `decisions.md`

## 문서 목록

- `current-status.md`: 현재 구현 상태와 주의할 점
- `next-task.md`: 지금 바로 이어서 하기 좋은 우선 작업
- `roadmap.md`: 단기/중기 방향
- `AI_WORKFLOW.md`: 미래 세션을 위한 문서 갱신 및 작업 운영 기준
- `doc-style-guide.md`: 문서 작성 톤과 commit message 규칙
- `architecture.md`: 앱 구조와 주요 파일 맵
- `setup.md`: 개발 환경, 실행, 테스트, 트러블슈팅
- `release-ci.md`: Windows 패키징, 코드 서명, CI 아티팩트 운영 가이드
- `release-notes/`: 태그별 릴리즈 노트
- `backlog.md`: 아이디어, 개선안, 아직 착수하지 않은 항목
- `decisions.md`: 프로젝트 운영/구조 관련 의사결정 기록
- `changelog.md`: 문서 체계 변경 기록

## 운영 원칙

- 루트 `README.md`는 저장소 진입 문서로 간결하게 유지합니다.
- 상세 운영 문서와 작업 메모는 모두 `docs/` 아래에서 관리합니다.
- 공개 저장소 첫 화면에 노출되는 내용은 현재 구현 사실과 보안상 공개 가능한 정보만 남깁니다.
- 작업이 끝나면 필요 시 `current-status.md`, `next-task.md`, `backlog.md`를 함께 갱신합니다.
