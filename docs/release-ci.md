# Release And CI

Last updated: 2026-04-29

## 빌드와 패키징

```bash
npm run build
npm run package:win
```

종속성 준비까지 한 번에 처리해야 하면:

```bash
npx electron-builder install-app-deps
npm run package:win
```

## 릴리스 버전 올리기

```bash
npm run release:patch
npm run release:patch -- 0.0.4
npm run release:patch -- minor
```

수동 대안:

```bash
npm version 0.0.4
git push
git push --tags
```

## CI 요약

- `main` 브랜치 푸시
- 태그(`v*`) 푸시
- 수동 실행

빌드 결과는 GitHub Actions 실행 페이지의 Artifacts에서 확인합니다.

## 아티팩트 다운로드

```bash
gh run list
gh run download <run-id> --name dist-windows-latest
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
gh secret set CSC_KEY_PASSWORD --body "password"
```

## 테스트용 인증서 주의

- 루트에 있는 `test-cert.pfx`, `test-cert.pfx.base64`는 테스트 목적입니다.
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
