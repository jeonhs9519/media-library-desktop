# Decisions

프로젝트 운영과 문서화 방식에 영향을 주는 결정을 기록합니다.

## 2026-04-29

### `docs/` 디렉터리 중심 문서화

- 이 저장소는 단일 프로젝트이므로 별도 문서 저장소를 만들지 않습니다.
- 대신 루트 아래 `docs/` 디렉터리를 두고, 상태/계획/운영 문서를 한곳에서 관리합니다.
- 루트 `README.md`는 저장소 입구 역할만 담당하고, 상세 문서는 `docs/`로 연결합니다.

### 문서 구조는 축약형으로 유지

- 참조한 `whismi-docs`의 운영 패턴 중 현재 프로젝트에 필요한 최소 세트만 가져옵니다.
- 핵심 문서는 `current-status`, `next-task`, `roadmap`, `decisions`, `changelog`입니다.
- 이 프로젝트 특성을 반영해 `architecture`, `setup`, `release-ci`, `backlog`를 추가합니다.

### 기존 루트 문서는 `docs/`로 흡수

- 기존 `README.CI.md` 내용은 `docs/release-ci.md`로 통합합니다.
- 기존 `TODO.md` 내용은 `docs/backlog.md`와 `docs/next-task.md`로 재구성합니다.
- 루트에는 상세 운영 문서를 계속 늘리지 않습니다.

### `AI_WORKFLOW.md` 도입

- 참조 문서 프로젝트의 `AI_WORKFLOW.md` 운영 방식 중 현재 저장소에 맞는 규칙만 축약 반영합니다.
- `develop` 고정 같은 저장소별 정책은 그대로 복제하지 않고, 현재 브랜치와 작업 트리 확인 규칙으로 조정합니다.
- 미래 세션은 `docs/AI_WORKFLOW.md`를 기준으로 문서 갱신 여부를 판단합니다.

### 문서 작성 규칙과 commit message 규칙 반영

- 참조 문서 프로젝트의 `doc-style-guide.md` 운영 방식을 이 저장소에도 적용합니다.
- 문서는 한글 중심으로 짧고 직접적으로 작성하되, 기술 용어와 코드 연결 이름은 영문 표기를 유지합니다.
- commit message는 `접두사: 제목` 형식을 기본으로 사용합니다.
- commit/push 실행 승인 규칙은 `AI_WORKFLOW.md`와 `doc-style-guide.md`에 함께 반영합니다.
