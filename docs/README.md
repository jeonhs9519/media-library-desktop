# Media Library Docs

Last updated: 2026-10-05

현재 구현과 운영 문서는 `docs/`에서 관리합니다. 루트 [README](../README.md)는 저장소 진입 안내이며, 버전별 배포 내용은 현재 소스 설명과 구분합니다.

## 읽기 순서

1. [Current Status](current-status.md): 현재 완료 범위·기능·최신 구현 검증
2. [Next Task](next-task.md)와 [Roadmap](roadmap.md): 착수 상태와 후속 방향
3. [AI Workflow](AI_WORKFLOW.md)와 [Doc Style Guide](doc-style-guide.md): 작업·문서 운영 기준
4. 작업에 필요한 구조·실행·릴리즈 문서
5. 결정·변경 이력과 미착수 후보

## 문서별 역할

| 문서 | 관리 내용 |
| --- | --- |
| [Current Status](current-status.md) | 현재 구현 사실과 날짜를 붙인 최신 검증 결과 |
| [Next Task](next-task.md) | 즉시 착수 상태와 별도 요청 시 진행할 순서 |
| [Roadmap](roadmap.md) | 완료 기준·후속 방향·유지 기준 |
| [Backlog](backlog.md) | 아직 착수하지 않은 후보 |
| [Architecture](architecture.md) | 모듈 경계·주요 파일·DB·IPC·런타임 흐름 |
| [Setup](setup.md) | 의존성 설치·실행·검사·데이터 위치·오류 대응 |
| [Release And CI](release-ci.md) | Windows 패키징·실제 CI 검사 범위·배포·서명 |
| [툴팁 기준](tooltip-guidelines.md) | 공용 Tooltip의 표시·정렬·컨테이너 경계 |
| [ZIP 성능](zip-performance.md) | 보관 정책과 측정 당시 조건·결과·한계 |
| [Decisions](decisions.md) | 날짜별 정책·구조 결정 |
| [Changelog](changelog.md) | 날짜별 구현·안정화·문서 변경 이력 |
| [릴리즈 노트](release-notes/) | 태그별 배포 내용 |
| [AI Workflow](AI_WORKFLOW.md) | 세션 시작·작업·종료와 Git 실행 기준 |
| [Doc Style Guide](doc-style-guide.md) | 문서 작성 톤과 commit message 규칙 |

## 갱신 기준

- 현재 상태는 기능별로 기록하고 작업 경과는 Changelog에 남깁니다.
- 최신 테스트 건수·검증일은 Current Status에서 관리합니다. 과거 이력·성능 측정의 건수는 당시 결과로 보존합니다.
- 완료한 작업은 Next Task·Roadmap·Backlog의 예정 항목에서 제거합니다.
- 구조·명령 안내는 실제 파일·package script·워크플로를 기준으로 확인합니다.
- 릴리즈 노트에는 해당 버전 이후의 미배포 변경을 섞지 않습니다.
