# media-library-desktop

로컬 PDF, ZIP(CBZ 포함), 비디오 파일을 SQLite로 관리하는 Electron 데스크톱 앱입니다. 프로필별 라이브러리, 태그·리뷰·썸네일·진행률과 이어보기를 제공합니다.

이 README는 현재 소스를 기준으로 설명합니다. `package.json` 버전은 `0.1.0`이며 이후 기능 개선과 안정화 작업도 포함합니다. 배포 버전별 기능은 [릴리즈 노트](docs/release-notes/)에서 확인합니다.

## 주요 기능

- PDF, ZIP(CBZ 포함), 비디오 등록과 포맷별 뷰어
- 제목·작성자·메모·원본 URL·태그·리뷰·썸네일·진행률 관리
- 콘텐츠 분류·언어·진행 상태·파일 상태·태그 AND 조건 검색
- 프로필별 라이브러리 분리, 선택·생성·삭제·전환과 항목 이동·복사
- 프로필별 복수 플레이리스트 생성·이름 변경·삭제·선택·재정렬
- 뷰어의 열람 전용 플레이리스트와 파일 타입 간 이전/다음·자동 이어보기
- PDF·ZIP의 한 페이지·스크롤·두 페이지 보기와 항목별 배율·읽기 위치 저장
- HDT와 과거 DB의 미리보기 가져오기, 태그명 병합과 파일 경로 재연결
- 한국어·영어·일본어·중국어 UI와 창 상태 복원
- Windows 포터블 ZIP 패키징과 태그 기반 GitHub Release 워크플로

## 배포판 사용

1. [GitHub Releases](https://github.com/jeonhs9519/media-library-desktop/releases)에서 원하는 버전의 Windows ZIP을 다운로드합니다.
2. 쓰기 가능한 폴더에 압축을 풀고 `MediaLibrary.exe`를 실행합니다.

DB는 실행 파일 폴더의 `media-library.db`, userData·session·logs·crash dumps는 같은 폴더의 `.data/`에 저장합니다. 폴더 이동·백업은 앱을 종료한 뒤 DB와 `.data/`를 함께 처리합니다. 과거 userData DB는 자동 복사하지 않으며 설정의 `과거 데이터 불러오기`에서 직접 선택합니다.

## 개발 환경

현재 의존성의 실행 조건에 맞춰 Node.js 22.x(22.12 이상)를 사용합니다. CI도 Node.js 22를 사용합니다.

```bash
npm ci
npm run dev
```

개발 앱의 데이터는 프로젝트 루트의 `media-library.db`와 `.data/`에 저장합니다. 설치·오류 대응은 [Setup](docs/setup.md)을 참고합니다.

## 테스트와 빌드

```bash
npm test
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.web.json
npm run build
npm run test:e2e
```

`test:e2e`는 자체 빌드 후 임시 데이터로 Electron 화면을 검사합니다. 최신 검증 기록은 [Current Status](docs/current-status.md), CI 검사와 배포 절차는 [Release And CI](docs/release-ci.md)에 기록합니다.

## 문서

- [문서 인덱스](docs/README.md): 문서별 역할과 읽기 순서
- [현재 상태](docs/current-status.md): 완료 범위·기능·최신 검증
- [다음 작업](docs/next-task.md): 별도 요청 시 Tauri 준비 순서
- [구조](docs/architecture.md): 모듈 경계·DB·IPC·화면 구성
- [실행 안내](docs/setup.md): 개발·테스트·데이터·오류 대응
- [릴리즈 안내](docs/release-ci.md): 패키징·CI·배포
- [릴리즈 노트](docs/release-notes/): 버전별 변경 사항

로컬 DB·로그·샘플·인증서·비밀번호 등 실행 데이터와 비밀정보는 저장소에 포함하지 않습니다.
