# CI — GitHub Actions 빌드 아티팩트 사용법

## 요약

- 트리거: `main` 브랜치 푸시, 태그(`v*`) 푸시, 또는 수동 실행
- 빌드 결과: Actions 실행 페이지 → 해당 job → `Artifacts`에 업로드

## 아티팩트 다운로드 (gh CLI 예)

```bash
gh run list
gh run download <run-id> --name dist-windows-latest
```

## Windows 코드 서명 설정

1. PFX 파일 준비
2. 리포지토리 Settings → Secrets and variables → Actions에 다음 시크릿 추가:
   - `CSC_LINK`: PFX 파일을 base64로 인코딩한 값 또는 HTTPS 업로드 URL
   - `CSC_KEY_PASSWORD`: PFX 비밀번호

로컬에서 base64 인코딩 예 (Linux/macOS):

```bash
base64 -w0 mycert.pfx > mycert.pfx.base64
```

또는 PowerShell (Windows):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('mycert.pfx')) > mycert.pfx.base64
```

## 테스트용 PFX 파일(로컬 생성용)

- 이 저장소 루트에 테스트용으로 `test-cert.pfx`와 `test-cert.pfx.base64` 파일을 생성해 두었습니다.
- 테스트 PFX 비밀번호: `password`
- 주의: 이 PFX는 **테스트 전용**입니다. 절대 공개 저장소에 `test-cert.pfx` 파일을 커밋하지 마세요.

## GitHub Secret 등록 예 (PowerShell, gh CLI)

```powershell
$base = Get-Content .\test-cert.pfx.base64 -Raw
gh secret set CSC_LINK --body "$base"
gh secret set CSC_KEY_PASSWORD --body "password"
```

또는 GitHub → Settings → Secrets and variables → Actions에서 `CSC_LINK`와 `CSC_KEY_PASSWORD`를 수동으로 추가하세요.

## 워크플로우 트리거 및 확인

- 메인 브랜치에 푸시하거나 Actions 탭에서 워크플로우를 수동 실행하세요.
- 실행이 성공하면 Actions → 해당 실행 → Artifacts에서 `dist-windows-latest`(또는 설정한 이름)를 다운로드할 수 있습니다.

## 안전 주의사항

- 실제 릴리스용 인증서는 신뢰할 수 있는 CA에서 발급받은 인증서를 사용하세요.
- 테스트 PFX는 개발/테스트 용도로만 사용하고, 배포용 파일은 별도로 관리하세요.
