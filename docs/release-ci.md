# Release And CI

Last updated: 2026-05-06

## 릴리즈 경로 요약

- 태그 `v*` 푸시가 정식 Windows ZIP 릴리즈 경로입니다.
- `CI - Build Electron ZIP` 워크플로가 의존성 설치, 테스트, 빌드, 패키징, ZIP 검증, GitHub Release 업로드를 처리합니다.
- `Create or Update Release Notes` 워크플로는 이미 존재하는 태그의 릴리즈 노트만 수동으로 다시 만들 때 사용합니다.
- `Check Artifact Storage Usage` 워크플로는 Actions artifact quota 상태를 점검할 때 수동으로 실행합니다.

## 로컬 사전 검증

릴리즈 전에는 작업 트리가 clean인지 확인하고, 테스트와 production build를 먼저 통과시킵니다.

```bash
git status --short
npm test
npm run build
```

샌드박스 환경에서 `npm test`가 `spawn EPERM`으로 실패하면, esbuild 프로세스 실행 제한 때문일 수 있으므로 승인된 터미널에서 다시 실행합니다.

## 로컬 패키징 확인

CI와 최대한 같은 순서로 Windows ZIP을 만들려면 다음 순서를 사용합니다.
Windows에서 개발 앱이나 Electron 프로세스가 실행 중이면 `better_sqlite3.node` 같은 native 모듈 파일이 잠겨 패키징이 실패할 수 있으므로, 패키징 전 실행 중인 앱을 먼저 종료합니다.

```bash
npm run build
npm run bundle:main
npx electron-builder install-app-deps
npm run package:win
```

생성물은 `dist/MediaLibrary_v<version>.zip`에서 확인합니다.

## 릴리스 버전 올리기

현재 버전은 `package.json`과 `package-lock.json`에 함께 기록됩니다. 다음 patch 릴리즈는 아래 명령을 사용합니다.

```bash
npm run release:patch
```

정확한 버전이나 minor/major 릴리즈가 필요하면 인자를 지정합니다.

```bash
npm run release:patch -- 0.0.7
npm run release:patch -- minor
npm run release:patch -- major
```

`scripts/release.js`는 버전 변경, `docs/release-notes/<tag>.md` 생성, release commit 생성, 태그 생성, `git push`, `git push --tags`까지 수행합니다. 릴리즈 노트 파일이 이미 있으면 새로 생성한 내용으로 덮어씁니다. 변경 중인 파일이 있으면 자동 stash/pop을 시도하지만, 릴리즈 직전에는 충돌을 피하기 위해 반드시 clean 상태에서 실행하는 것을 원칙으로 합니다.

수동 대안:

```bash
npm version 0.0.7 --no-git-tag-version
npm run release:notes:docs -- --tag v0.0.7 --to HEAD --out docs/release-notes/v0.0.7.md
git add package.json package-lock.json docs/release-notes/v0.0.7.md
git commit -m "chore(release): 0.0.7"
git tag v0.0.7
git push
git push --tags
```

## CI 요약

- 태그(`v*`) 푸시: Windows ZIP 빌드 후 같은 태그의 GitHub Release에 ZIP을 업로드합니다.
- 수동 실행: Windows ZIP을 빌드하고, 선택 시 `dist-windows-latest` Actions artifact로 업로드합니다.
- `main` 브랜치 푸시는 현재 릴리즈 빌드를 실행하지 않습니다.

태그 릴리즈에서는 `package.json` 버전과 태그명이 일치해야 합니다. 예를 들어 `package.json` 버전이 `0.0.7`이면 태그는 `v0.0.7`이어야 합니다.
CI는 checkout 직후, 의존성 설치나 Windows ZIP 빌드 전에 `docs/release-notes/<tag>.md`가 존재하고 `## 릴리즈 개요`로 시작하는지 먼저 확인합니다. 이후 `dist` 안에 ZIP 파일이 정확히 1개 생성되었고 비어 있지 않은지 확인한 뒤, 해당 릴리즈 노트 파일을 GitHub Release 본문으로 사용해 Release 업로드를 진행합니다.

## GitHub Release 산출물

- 정식 릴리즈 ZIP: GitHub Releases의 해당 태그 페이지에서 확인합니다.
- 수동 빌드 ZIP: GitHub Actions 실행 페이지의 Artifacts에서 확인합니다.
- 수동 빌드 artifact는 quota 보호를 위해 3일 보관합니다.

## Actions 완료 대기 기준

`CI - Build Electron ZIP` 워크플로의 Windows ZIP 패키징은 20분 이상 걸릴 수 있습니다. Codex 세션에서는 릴리즈 명령 후 Actions 완료까지 장시간 polling하지 않습니다.

릴리즈 요청을 받으면 Codex는 아래까지만 확인합니다.

- `release:patch` 실행 성공
- `main` push 성공
- 태그 push 성공
- 가능하면 Actions run 생성 여부

Actions 완료 여부, Release asset 업로드 완료 여부, 실패 로그 분석은 사용자가 GitHub에서 확인한 뒤 필요할 때 다시 요청합니다. 실패 시에는 해당 run 로그를 기준으로 별도 수정 작업을 진행합니다.

## 아티팩트 다운로드

```bash
gh run list
gh run download <run-id> --name dist-windows-latest
```

## 릴리즈 노트 재생성

태그는 이미 있는데 Release 본문만 다시 반영하고 싶다면 `Create or Update Release Notes` 워크플로를 수동 실행하고 `tag` 입력에 `v0.0.7`처럼 기존 태그명을 넣습니다. 이 워크플로는 ZIP을 빌드하거나 첨부하지 않고, 태그에 포함된 `docs/release-notes/<tag>.md`를 GitHub Release 본문으로 그대로 사용합니다.

릴리즈 노트는 `scripts/build-release-notes.js`가 이전 semver 태그와 현재 태그 사이의 `git log`를 읽어 자동 생성합니다. 커밋 제목과 본문을 기준으로 주요 기능, UI/UX 개선, 구조 및 성능, 배포 및 CI, 문서 및 계획 항목으로 묶습니다.
GitHub Release 화면이 이미 버전 제목을 표시하므로, 생성 본문은 `# v0.0.7` 같은 최상위 제목 없이 `## 릴리즈 개요`부터 시작합니다.
저장소에 남기는 정리본은 `docs/release-notes/v0.0.7.md`처럼 버전별 파일로 관리합니다.

로컬 미리보기:

```bash
npm run release:notes -- --tag v0.0.7 --out RELEASE_NOTES.md
```

릴리즈 commit에 들어갈 파일을 직접 생성하거나 덮어쓰려면 아래 명령을 사용합니다.

```bash
npm run release:notes:docs -- --tag v0.0.7 --to HEAD --out docs/release-notes/v0.0.7.md
```

GitHub Release 본문과 같은 내용을 임시 파일과 `docs/release-notes/`에 함께 저장하려면 `--save-docs`를 사용할 수도 있습니다.

```bash
npm run release:notes -- --tag v0.0.7 --out RELEASE_NOTES.md --save-docs
```

## Windows 코드 서명

필요한 GitHub Actions 시크릿:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`

PFX 파일을 base64로 인코딩해 `CSC_LINK`에 넣거나 업로드 URL을 사용합니다.

PowerShell 예시:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('mycert.pfx')) > mycert.pfx.base64
```

테스트용 예시:

```powershell
$base = Get-Content .\test-cert.pfx.base64 -Raw
gh secret set CSC_LINK --body "$base"
gh secret set CSC_KEY_PASSWORD --body "<password>"
```

## 테스트용 인증서 주의

- 로컬에 있는 `test-cert.pfx`, `test-cert.pfx.base64`는 테스트 목적입니다.
- 공개 저장소에는 실제 배포용 인증서나 비밀번호를 포함하지 않습니다.
- 실제 릴리스용 인증서는 신뢰 가능한 CA 발급본을 별도로 관리해야 합니다.

## Artifact quota 이슈

아래 오류가 나오면 GitHub Actions artifact quota 초과입니다.

```text
Failed to CreateArtifact: Artifact storage quota has been hit.
Unable to upload any new artifacts. Usage is recalculated every 6-12 hours.
```

필요 시 불필요한 아티팩트를 삭제합니다.

```bash
gh api /repos/<owner>/<repo>/actions/artifacts | jq '.artifacts[] | {id, name, size_in_bytes, created_at}'
gh api --method DELETE /repos/<owner>/<repo>/actions/artifacts/<artifact_id>
```
