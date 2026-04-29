# AI Workflow

이 문서는 미래의 Codex 세션이 `media-library-desktop`에서 같은 방식으로 문서를 읽고 갱신하도록 돕는 운영 기준입니다.

## 1. Start Of Every Session

세션 시작 시 먼저 아래 문서를 읽습니다.

- `current-status.md`
- `next-task.md`
- `roadmap.md`

상황에 따라 아래 문서도 함께 확인합니다.

- `doc-style-guide.md`
- `architecture.md`
- `backlog.md`
- `decisions.md`
- `changelog.md`

## 2. During Work

- 문서는 현재 작업 기준의 source of truth로 사용합니다.
- 코드 실제 상태가 문서와 다르면, 코드 기준으로 확인한 뒤 문서를 갱신합니다.
- 이전 채팅 문맥에 의존하지 않습니다.
- 문서 작성 톤과 commit message 제안은 `doc-style-guide.md`를 따릅니다.
- 작업 시작 전 현재 브랜치와 작업 트리 상태를 확인합니다.
- 이미 존재하던 변경사항은 사용자 작업일 수 있으므로 임의로 되돌리지 않습니다.
- 관련 없는 문서를 넓게 다시 쓰기보다, 현재 작업과 연결된 문서만 갱신합니다.

## 3. End Of Meaningful Work

의미 있는 작업이 끝나면 아래 기준으로 문서를 갱신합니다.

- 현재 프로젝트 상태가 바뀜
  - `current-status.md` 갱신
- 즉시 우선순위가 바뀜
  - `next-task.md` 갱신
- 중기 계획이 바뀜
  - `roadmap.md` 갱신
- 아키텍처나 운영 방식에 결정이 생김
  - `decisions.md`에 추가
- 장기 후보 작업 목록이 바뀜
  - `backlog.md` 갱신
- 문서 체계나 중요한 작업 흐름이 바뀜
  - `changelog.md`에 추가

## 4. Commit And Push Confirmation Rule

- commit message 요청은 실행 요청이 아니라 검토 요청으로 해석합니다.
- commit message를 제안할 때는 변경 요약과 검증 결과를 먼저 정리합니다.
- 실제 `git commit`, `git push`, PR 생성, merge는 사용자가 명시적으로 요청했을 때만 수행합니다.
- 사용자가 메시지만 요청한 경우에는 Git 실행을 하지 않습니다.
- commit 이후 push 요청이 따로 없다면 push 전에 다시 확인합니다.

## 5. Documentation Principles

- 사실 기준으로 씁니다.
- 짧고 명확하게 유지합니다.
- 전체 재작성보다 점진적 수정을 우선합니다.
- 관련 없는 구간은 다시 쓰지 않습니다.
- 기존에 유용한 내용은 보존합니다.
- 작업 후 문서가 이전보다 더 정확해지도록 유지합니다.
- 문서 표현과 commit message 형식의 세부 규칙은 `doc-style-guide.md`를 우선 기준으로 사용합니다.

## 6. Language Policy

- 문서는 기본적으로 한글로 작성합니다.
- 기술 용어는 자연스러운 경우 영문을 유지합니다.

예:

- `Electron`
- `React`
- `SQLite`
- `IPC`
- `Release`
- `Queue`

## 7. Operational Rule

- 문서를 갱신해야 하는지 애매하면, 오래된 문서를 남기기보다 갱신하는 쪽을 우선합니다.
- 정기 점검보다 실제 작업 변화와 결정 사항을 기준으로 문서를 갱신합니다.
- Codex Desktop의 기본 샌드박스에서는 `npm.cmd run dev`가 `spawn EPERM`으로 실패할 수 있습니다.
- 사용자가 개발 앱 실행을 요청하면 샌드박스 내부 실행을 먼저 시도하지 말고, 승인된 `npm.cmd run dev` 방식으로 바로 실행합니다.
- 단순 텍스트 일부 변경이 아닌 코드/구조 변경 후 개발 앱 동작 확인을 요청받으면, 기존 개발 앱 프로세스를 먼저 종료한 뒤 새로 `npm.cmd run dev`를 실행합니다.
- 특히 main/preload 변경, 큰 renderer 구조 변경, 라우팅/모달/포커스 동작 변경 후에는 새로 실행한 앱에서 확인합니다.

## 8. Future Sessions

- 미래의 모든 Codex 세션은 이 파일을 먼저 읽고 따릅니다.
- 작업 종료 시 문서 상태를 한 단계라도 더 낫게 만드는 것을 목표로 합니다.

## 9. Scope Rule For This Repository

- 이 저장소는 단일 프로젝트이므로 별도 `status/` 디렉터리를 운영하지 않습니다.
- 프로젝트 전체 상태는 `current-status.md` 한 문서에서 관리합니다.
- 새 기능 축이 커지면 먼저 `architecture.md`와 `backlog.md` 반영 여부를 검토합니다.

## 10. Branch Policy

- 이 저장소는 현재 `main` 브랜치를 사용하고 있습니다.
- 미래에 별도 작업 브랜치 정책이 정해지기 전까지는, 작업 시작 시 현재 브랜치 확인을 기본 규칙으로 둡니다.
- 브랜치 전략이 바뀌면 `decisions.md`와 이 문서를 함께 갱신합니다.
