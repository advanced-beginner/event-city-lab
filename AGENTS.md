# Event City Lab 유지보수 지침

이 파일은 이 저장소에서 작업하는 개발자와 코딩 에이전트가 항상 따라야 할 프로젝트 구성 및 유지보수 규칙이다. 제품의 학습 흐름, 챕터별 구현 현황, 미비점과 TODO는 반드시 [`project-details.md`](./project-details.md)에서 관리한다. 시각·인터랙션 계약은 [`DESIGN.md`](./DESIGN.md)를 기준으로 한다.

## 작업 전 필수 확인

1. 이 `AGENTS.md`를 먼저 읽는다.
2. 현재 구현 범위와 남은 작업은 `project-details.md`에서 확인한다.
3. UI 또는 SVG를 변경할 때는 `DESIGN.md`를 함께 확인한다.
4. 실행 환경과 배포 방법은 `README.md`, `package.json`, `vite.config.ts`, `.github/workflows/deploy.yml`을 확인한다.
5. 기존 작업 트리가 dirty 상태라면 사용자의 변경을 보존하고, 관련 없는 파일을 되돌리지 않는다.

## 기술 구성

- Runtime: React 19, TypeScript strict, Vite 8
- UI: CSS Modules, inline SVG, Google Fonts `Nanum Gothic`
- State: Zustand vanilla store
- Simulation: 순수 TypeScript 결정론적 엔진 + module Web Worker
- Validation: Zod 4 strict schemas
- Persistence: IndexedDB(`idb`) + 작은 사용자 환경 설정용 localStorage
- Code editor: CodeMirror 6 core 직접 통합
- Test: Vitest + jsdom + Testing Library 설정
- Hosting: GitHub Pages, Vite base `/event-city-lab/`, hash URL `#/chapter/1`

## 디렉터리와 책임

- `src/domain/`: Kafka 학습 규칙, 이벤트 타입, 시뮬레이션 엔진, Zod schema. UI 의존성을 두지 않는다.
- `src/worker/`: UI와 엔진 사이의 typed Web Worker 경계. 모든 요청·응답은 schema로 검증한다.
- `src/state/`: workspace와 재생 UI 상태. Kafka 결과를 계산하지 않는다.
- `src/storage/`: IndexedDB와 JSON import/export 경계. 신뢰하지 않는 데이터를 schema로 검증한다.
- `src/components/`: 재사용 가능한 UI 및 SVG 도시 구성요소.
- `src/App.tsx`: 화면 조합과 사용자 흐름. 도메인 규칙을 중복 구현하지 않는다.
- `src/styles/` 및 CSS Modules: 전역 token, 레이아웃, 컴포넌트 표현.
- `public/`: 정적 배포 파일. 외부 라이선스가 불명확한 자산을 넣지 않는다.
- `.github/workflows/`: test, build, GitHub Pages 배포 자동화.
- `DESIGN.md`: 활성 디자인 계약.
- `project-details.md`: 제품 흐름, 현재 상태, 알려진 미비점, 향후 TODO의 단일 기록.

## 변경 시 지켜야 할 불변 조건

### 도메인과 이벤트

- React 컴포넌트는 Kafka 결과를 계산하지 않는다. 결과와 이벤트 순서는 `src/domain/engine.ts`가 생성한다.
- UI 애니메이션 시간은 표시 속도만 바꾸며 logical time과 실행 결과를 변경하지 않는다.
- 동일 입력과 동일 seed는 동일한 이벤트 기록을 생성해야 한다. 단, `runId`처럼 명시적으로 입력에 포함된 식별자는 예외다.
- 완료된 `SimulationRun`은 불변 증거다. 설정 변경으로 과거 실행을 수정하지 않는다.
- 이벤트 type을 추가하거나 변경할 때 `simulation.ts`, `schemas.ts`, worker protocol, UI label, 테스트를 함께 갱신한다.
- Kafka 규칙이나 설정 설명을 변경할 때 현재 공식 Apache Kafka 문서에서 비권장 또는 제거된 설정인지 확인한다. 확인한 기준 버전과 변경 이유를 `project-details.md`에 기록한다.

### 저장과 버전

- 저장 데이터는 `WorkspaceSnapshot`과 `workspaceSnapshotSchema`를 항상 함께 변경한다.
- `storageSchemaVersion`을 올릴 때 기존 IndexedDB 데이터와 export JSON을 위한 migration 또는 명시적인 호환 중단 처리를 제공한다.
- `APP_VERSION`, `CONTENT_VERSION`, `KAFKA_RULE_VERSION`, `STORAGE_SCHEMA_VERSION`의 의미를 혼용하지 않는다.
- 실행 기록은 최대 20개를 유지한다. 이 제한을 바꾸면 저장 용량과 비교 UI 영향을 함께 검토한다.
- 사용자 진행 데이터는 브라우저 로컬 저장만 사용한다. 서버 전송이나 계정 기능은 별도 승인 없이는 추가하지 않는다.

### UI와 SVG

- 지원 대상은 100% 확대 기준 `1280×720` 이상 `1920×1080` 이하의 PC 브라우저다. 이 범위에서는 페이지 자체의 가로·세로 스크롤을 만들지 않는다.
- 긴 코드와 로그만 패널 내부 스크롤을 허용한다.
- 상태는 색상만으로 표현하지 않고 문구, 아이콘, 형태 또는 선 스타일을 함께 제공한다.
- `prefers-reduced-motion`과 앱의 모션 줄임 설정을 유지한다.
- 핵심 조작은 키보드로 가능해야 하며 SVG 시설에는 접근 가능한 이름을 제공한다.
- Producer, Serializer, Broker 시설과 메시지 차량의 identity를 챕터 흐름 전체에서 일관되게 유지한다.
- 외부 유료·Pro·워터마크 자산을 복제하거나 배포 산출물에 포함하지 않는다. 새 SVG는 독립적으로 제작하고 `xlink`를 사용하지 않는다.
- 생성형 이미지 자산은 `src/assets/city/source/`에 생성 프롬프트·마스터·전체 분리본을 보존하고, 실제 번들은 `src/assets/city/sprites/`에서 명시적으로 import한 PNG만 포함한다. 자산 메타데이터와 앵커는 `src/assets/city/manifest.json`, 공통 색상은 `src/assets/city/palette.json`을 기준으로 한다.
- 도시 건물·Producer·Serializer·Broker·메시지 차량은 동일 master에서 분리한 PNG를 `CitySprite`와 SVG `<image href>`로 배치한다. 시설 클릭 영역, 접근 가능한 이름, 상태 램프·오류 표지·ACK와 도착 문자는 동적 SVG로 유지한다.
- Pixel sprite는 `image-rendering: pixelated`를 유지한다. 마스터 전체나 사용하지 않는 sprite를 runtime에서 import하지 않으며 runtime 도시 PNG 합계는 1.5MB 이하로 관리한다.
- Google Fonts가 실패해도 시스템 fallback으로 기능과 레이아웃이 유지되어야 한다.

### 의존성과 라이선스

- 새 의존성을 추가하기 전에 현재 도구로 해결 가능한지 먼저 확인한다.
- 의존성 추가·업그레이드는 공식 문서, 유지보수 상태, 라이선스, deprecated API 여부를 확인한다.
- 외부 font, icon, image 또는 code를 도입하면 `THIRD_PARTY_NOTICES.md`와 필요한 라이선스 파일을 갱신한다.
- 직접 작성한 소스 코드와 학습 콘텐츠의 라이선스 구분은 `LICENSE`, `LICENSE-CONTENT.md`를 유지한다.

## 구현 및 검증 절차

1. 변경할 동작과 불변 조건을 `project-details.md`와 현재 테스트에서 확인한다.
2. 도메인 변경은 먼저 순수 엔진과 schema에 반영하고 단위 테스트를 작성한다.
3. worker, store, UI 순서로 연결하며 동일 규칙을 여러 계층에 복제하지 않는다.
4. UI 변경은 초기, 실패, 수정 대기, 성공, 되감기 상태를 확인한다.
5. 다음 명령을 모두 실행한다.

```bash
npm run typecheck
npm run test:run
npm run build
```

6. 레이아웃 변경은 최소 `1280×720`, `1440×900`, `1920×1080`에서 page overflow와 핵심 텍스트 clipping을 확인한다.
7. GitHub Pages 관련 변경은 `/event-city-lab/` base와 hash URL에서 asset 및 worker 경로를 검증한다.
8. 완료 범위, 새 미비점, 후속 TODO가 생기면 같은 변경에서 `project-details.md`를 갱신한다.

## 문서 유지 규칙

- `AGENTS.md`에는 프로젝트 구성, 불변 조건, 작업 및 유지보수 방법만 작성한다.
- 사용자 여정, 챕터 내용, 구현 현황, 알려진 문제, 로드맵과 TODO는 `project-details.md`에 작성한다.
- 디자인 token, 화면 구성, 반응 상태의 source of truth는 `DESIGN.md`에 작성한다.
- 설치, 로컬 실행, 배포 진입점은 `README.md`를 간결하게 유지한다.
- 같은 정보를 여러 문서에 장문으로 복제하지 말고 각 source of truth를 링크한다.

## 커밋과 완료 기준

- 커밋은 하나의 의도와 검증 가능한 범위를 가진다.
- commit message는 저장소의 Lore 형식을 따른다: 의도를 설명하는 첫 줄과 필요 시 `Constraint`, `Rejected`, `Confidence`, `Scope-risk`, `Directive`, `Tested`, `Not-tested` trailer를 사용한다.
- 완료를 선언하기 전에 관련 테스트, typecheck, build와 필요한 브라우저 검증 결과를 실제로 확인한다.
- 테스트하지 못한 항목은 숨기지 않고 `Not-tested`와 `project-details.md`의 미비점에 남긴다.
