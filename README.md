# media-library-desktop

로컬 PDF/CBZ(만화)·동영상 파일을 SQLite 기반으로 태그/평가/썸네일/이어보기까지 관리하는 개인 미디어 라이브러리 데스크톱 앱.

## 실행 방법

### 사전 요구사항

- [Node.js](https://nodejs.org/) 18 이상
- [pnpm](https://pnpm.io/) (`npm install -g pnpm` 또는 `corepack enable`)

### 의존성 설치

```bash
pnpm install
```

### DB 마이그레이션

```bash
pnpm db:generate
pnpm db:migrate
```

### 개발 모드 실행

```bash
pnpm dev
```

### 빌드 (배포용 패키지 생성)

```bash
pnpm build
```

### 테스트 실행

```bash
# 유닛 테스트
pnpm test

# E2E 테스트
pnpm test:e2e
```
