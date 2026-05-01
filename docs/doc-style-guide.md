# Doc Style Guide

Last updated: 2026-04-29

`media-library-desktop` 문서는 기본적으로 한글 중심으로 작성합니다. 다만 기술 용어, 코드와 직접 연결되는 이름, 고유명사는 영어 표기를 유지합니다.

## 영어 표기 유지 대상

- 기술 용어: `Electron`, `React`, `SQLite`, `IPC`, `Release`, `Route`, `Queue`
- Library, Framework, 제품명, 서비스명
- 코드와 연결되는 경로, 파일명, 환경 변수명, HTTP method, endpoint
- Git branch, commit hash, package script, CLI command

## 작성 원칙

- 설명은 한글 중심으로 짧고 직접적으로 작성합니다.
- 추정이라면 추정이라고 표시하고, 확인된 사실과 구분합니다.
- 문서는 회의록처럼 길게 쓰지 않고 바로 갱신 가능한 길이를 유지합니다.
- 불확실한 홍보성 표현, 추상적인 문구, 근거 없는 배경 설명은 제외합니다.
- 제목은 가능하면 한글로 쓰되, 문서 성격을 명확히 하는 영어 기술 용어는 유지합니다.

## Commit Message 규칙

사용자가 아주 특별하게 다른 형식을 요청하지 않는 한, commit message는 항상 이 문서의 규칙을 기준으로 작성합니다.

기본 형식:

```text
{prefix}: {title}
```

본문이 필요한 경우에는 빈 줄 뒤에 구체적인 변경사항을 bullet로 작성합니다.

```text
정리: docs 디렉터리로 문서 구조 통합

- 루트 문서를 docs 중심 구조로 재배치
- README.CI.md와 TODO.md 내용을 docs로 이관
```

### Prefix 예시

- `추가`: 새로운 기능, 문서, 설정 추가
- `수정`: 기존 기능, 문서, 설정 변경
- `정리`: 구조 정리, 문서 이관, 불필요한 내용 축소
- `삭제`: 더 이상 사용하지 않는 파일 또는 코드 제거
- `보안`: secret, 인증, 권한, 취약점 관련 변경
- `배포`: build, release, packaging, CI/CD 관련 변경

### 작성 기준

- `{title}`은 한글 중심으로 작성하되, `README.md`, `SQLite`, `Electron`, `media-library-desktop` 같은 기술 표기는 유지합니다.
- 제목만으로 변경 의도가 드러나게 작성합니다.
- 내용이 단순하면 한 줄 commit message만 사용해도 됩니다.
- 변경 이유나 영향 범위가 있으면 본문 bullet에 구체적으로 적습니다.
- commit message 요청은 실제 commit 실행 요청으로 해석하지 않습니다.
- commit message를 제안할 때는 변경 요약과 검증 결과를 함께 제시합니다.
- 실제 `git commit`은 사용자가 명시적으로 승인한 뒤에만 수행합니다.
- 실제 `git push`는 사용자가 명시적으로 승인한 뒤에만 수행합니다.
- commit은 승인되었지만 push가 명시되지 않았다면 push 전에 다시 확인합니다.

## 갱신 원칙

- 상태 문서는 현재 사실 위주로 갱신합니다.
- 우선순위가 바뀌면 `next-task.md`를 먼저 수정합니다.
- 장기 후보 작업은 `backlog.md`에 모읍니다.
