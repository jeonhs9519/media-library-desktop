# AI Workflow

이 문서는 미래의 Codex 세션이 `media-library-desktop`에서 같은 방식으로 문서를 읽고 갱신하도록 돕는 운영 기준입니다.

## 1. Start Of Every Session

새 세션은 반드시 이 순서로 시작합니다.

1. `docs/README.md`의 문서 읽기 순서를 확인합니다.
2. `docs/current-status.md`, `docs/next-task.md`, `docs/roadmap.md`, `docs/AI_WORKFLOW.md`를 읽습니다.
3. 작업 성격에 따라 `docs/doc-style-guide.md`, `docs/architecture.md`, `docs/backlog.md`, `docs/decisions.md`, `docs/changelog.md`를 확인합니다.
4. 문서 확인 후 바로 사용자의 요청을 수행합니다.
5. 문서와 코드가 다르면 코드 확인 후 필요한 문서를 갱신합니다.

문서를 읽었다는 별도 보고는 사용자가 요청하지 않는 한 생략합니다.

## 2. During Work

- 문서는 현재 작업 기준의 source of truth로 사용합니다.
- 코드 실제 상태가 문서와 다르면, 코드 기준으로 확인한 뒤 문서를 갱신합니다.
- 이전 채팅 문맥에 의존하지 않습니다.
- 문서 작성 톤과 commit message 제안은 `doc-style-guide.md`를 따릅니다.
- 작업 시작 전 현재 브랜치와 작업 트리 상태를 확인합니다.
- 이미 존재하던 변경사항은 사용자 작업일 수 있으므로 임의로 되돌리지 않습니다.
- 관련 없는 문서를 넓게 다시 쓰기보다, 현재 작업과 연결된 문서만 갱신합니다.
- 작업 중 완료/예정/우선순위 표현이 바뀌면 관련 문서도 같은 턴 안에서 함께 갱신합니다.
- 사용자가 별도로 문서 갱신을 요청하지 않아도, 의미 있는 코드/UX/운영 변경이 있으면 문서 반영 여부를 반드시 점검합니다.

## 3. End Of Meaningful Work

의미 있는 작업이 끝나면 아래 기준으로 문서를 갱신합니다. 이 단계는 선택 사항이 아니라 작업 완료 절차입니다.

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

작업 종료 전에는 아래를 반드시 확인합니다.

1. `next-task.md`에 이미 완료된 항목이 다음 후보나 우선순위로 남아 있지 않은지 확인합니다.
2. `current-status.md`에 “예정”, “수정 예정”, “구현 예정” 같은 문구가 실제 완료 상태와 충돌하지 않는지 확인합니다.
3. `backlog.md`에는 아직 착수하지 않았거나 테스트로 남길 항목만 남깁니다.
4. 정책이나 UX 결정이 생겼다면 `decisions.md`에 남겼는지 확인합니다.
5. 작업 내역은 `changelog.md`에 짧게 남깁니다.
6. 중기 방향이나 다음 우선순위가 바뀌었다면 `roadmap.md`도 함께 점검합니다.

## 4. Commit And Push Confirmation Rule

- commit message 요청은 실행 요청이 아니라 검토 요청으로 해석합니다.
- commit message를 제안하기 전, 관련 문서가 최신 상태인지 먼저 확인합니다.
- 사용자가 아주 특별하게 다른 형식을 요청하지 않는 한, commit message는 항상 `doc-style-guide.md`의 규칙을 기준으로 작성합니다.
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
- commit message 형식은 사용자의 명시적인 예외 요청이 없는 한 `doc-style-guide.md`를 벗어나지 않습니다.
- 문서 갱신은 “나중에 할 일”로 남기지 않고, 현재 변경의 일부로 취급합니다.
- 문서와 코드가 어긋난 상태로 commit message를 제안하지 않습니다.

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
