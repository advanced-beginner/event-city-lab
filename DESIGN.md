# Event City Lab — Design Contract

## 1. Product context

### Audience

- Kafka를 처음 배우며 첫 메시지 발송부터 막히는 학습자
- 설정의 이름은 알지만 장애 상황에서 원인과 결과를 연결하기 어려운 실무자
- 모바일이 아닌 PC 브라우저에서 실험형 학습을 원하는 한국어 사용자

### User goal

사용자는 Kafka 설정을 외우는 대신, 메시지를 보내고 실패하고 증거를 조사하고 설정을 수정한 뒤 동일 조건으로 재실행하여 설정의 효과와 대가를 설명할 수 있어야 한다.

### Product promise

`설정 → 예측 → 실행 → 실패 → 증거 조사 → 진단 → 수정 → 동일 조건 재실행 → 비교`를 한 화면에서 반복하는 결정론적 Kafka 장애 실험실을 제공한다.

### In-scope flows

1. 첫 Producer 메시지 발송과 Serializer 실패
2. key, partition, ordering
3. acknowledgements, retry, idempotence
4. broker, replica, ISR
5. consumer, offset
6. consumer group, rebalance
7. retry topic, DLT
8. transaction

Milestone 0는 1번 흐름의 완결된 세로 절편만 구현한다.

### Content and version contract

- UI 언어: 한국어 우선
- Kafka 규칙 기준: Apache Kafka 4.3.1
- `appVersion`: `0.1.0`
- `contentVersion`: `2026.1`
- `kafkaRuleVersion`: `4.3.1`
- `storageSchemaVersion`: `1`
- 제품은 Apache Software Foundation의 공식 제품이 아니며 Apache Kafka 상표와 프로젝트와의 관계를 명확히 고지한다.

## 2. Experience principles

1. **먼저 실패한다.** 기본 시나리오는 잘못된 Serializer로 시작한다.
2. **정답보다 증거가 먼저다.** 결과 요약 전에 로그, 타임라인, 컴포넌트 상태를 조사하게 한다.
3. **설정은 세계에 흔적을 남긴다.** 설정 변경은 관련 SVG 요소와 이벤트 경로를 즉시 강조한다.
4. **같은 조건으로 비교한다.** 수정 전후 실행은 동일한 seed와 입력을 사용한다.
5. **가르치되 대신 풀지 않는다.** 힌트는 관찰 → 범위 → 원리 → 수정안의 네 단계로 열린다.
6. **시간을 조작할 수 있다.** 재생, 일시정지, 한 단계, 되감기로 모든 상태 전이를 조사한다.
7. **색상만으로 말하지 않는다.** 상태는 색, 아이콘, 형태, 텍스트를 함께 사용한다.

## 3. Information architecture

### Primary layout

- 상단: 미션 브리핑, 진행 상태, 버전/저장 상태
- 좌측 25%: 메시지와 Producer 설정, 제한된 Java 코드 편집
- 중앙 55%: SVG 기반 isometric Kafka 물류 도시
- 하단 20%: 실행 제어, 이벤트 타임라인, 로그와 장애 분석

최적 기준은 `1440 × 900`, 최소 지원은 `1280 × 720`이다. 모바일 레이아웃은 v1 범위가 아니다.

### Milestone 0 journey

1. 기본 메시지와 잘못된 String Serializer를 확인한다.
2. “메시지 보내기”를 누른다.
3. 메시지가 Producer 내부 Serializer 게이트에서 실패한다.
4. 로그, 타임라인, 상태 배지, 힌트를 조사한다.
5. 설정 패널 또는 Java 코드에서 JSON Serializer로 수정한다.
6. 동일 메시지를 재실행한다.
7. Broker leader append와 ACK를 관찰한다.
8. 이전 실패 실행과 성공 실행을 비교한다.
9. 진행 상태가 브라우저에 저장되고 재방문 시 복원된다.

## 4. Design system

### Visual language

- 3D pixel-art logistics city metaphor
- SVG가 핵심 월드와 상태 표현의 원본이다.
- 8px 공간 단위, 2:1 isometric grid, 26.565° 대각선
- 월드 오브젝트는 단단한 픽셀 형태, UI 텍스트와 코드는 현대적인 고가독성 스타일
- 광원은 좌상단으로 고정하고 윗면·좌면·우면의 명도 순서를 일관되게 유지한다.

### Color tokens

| Token | Value | Purpose |
| --- | --- | --- |
| `--city-950` | `#07111f` | 최하위 배경 |
| `--city-900` | `#0b1729` | 패널 배경 |
| `--city-800` | `#12243b` | 표면/선로 |
| `--ink-100` | `#edf7ff` | 주요 텍스트 |
| `--ink-300` | `#a7bad0` | 보조 텍스트 |
| `--cyan-400` | `#42e8e0` | 활성/정보 |
| `--amber-400` | `#ffc857` | 대기/주의 |
| `--red-400` | `#ff6577` | 실패/차단 |
| `--green-400` | `#65e69d` | 성공/완료 |
| `--violet-400` | `#a78bfa` | 설정 영향 |

### Typography

- UI: system Korean sans-serif stack
- 코드/로그/수치: `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace
- 최소 본문 크기 14px, 기본 16px, 주요 수치 20–28px

### Shape language

- 정상: 원/체크
- 진행: 다이아몬드/화살표
- 경고: 삼각형/느낌표
- 실패: 팔각형/X
- 선택된 설정 영향: 보라색 외곽선과 연결선

### Spacing and radius

- spacing: 4, 8, 12, 16, 24, 32px
- 패널 radius: 12px
- 제어 요소 radius: 8px
- pixel-art SVG 외곽선은 2px 또는 3px, `shape-rendering: crispEdges`

## 5. Component and state contract

### Core SVG components

- `ProducerStation`: idle, active, blocked, failed, complete
- `SerializerGate`: compatible, incompatible, processing
- `MessageCrate`: queued, moving, rejected, appended, acknowledged
- `BrokerWarehouse`: idle, receiving, appended, unavailable
- `AckDrone`: hidden, returning, delivered
- `DataRail`: dormant, active, blocked, complete

모든 컴포넌트는 `state`, `selected`, `affectedBySetting`, `reducedMotion` 속성을 받는 방향으로 설계한다.

### Message identity

메시지에는 실행을 가로질러 비교 가능한 `messageId`, 실행 내부 `attempt`, 현재 `stage`가 표시된다. 같은 seed의 재실행은 같은 message identity를 유지한다.

### Bidirectional highlighting

- 설정 필드에 hover/focus하면 해당 SVG 컴포넌트와 경로가 강조된다.
- SVG 컴포넌트 또는 실패 이벤트를 선택하면 관련 설정 필드가 강조되고 설명이 열린다.

### Playback

- logical time은 엔진 이벤트 순서와 `atMs`가 결정한다.
- display time은 애니메이션 속도에만 영향을 주고 결과에는 영향을 주지 않는다.
- `play`, `pause`, `step`, `rewind`가 동일 이벤트 기록을 탐색한다.

### Hints

1. 관찰할 위치를 알려준다.
2. 원인의 범위를 좁힌다.
3. Kafka 원리를 설명한다.
4. 구체적인 수정 방향을 보여준다.

## 6. Accessibility and interaction

- WCAG 2.2 AA 대비를 목표로 한다.
- 전체 핵심 흐름은 키보드만으로 완료할 수 있어야 한다.
- focus ring은 최소 2px이며 배경과 명확히 대비된다.
- SVG 상태에는 텍스트 대안과 화면 내 상태 설명을 제공한다.
- `prefers-reduced-motion`과 앱 내 reduced motion 설정을 모두 지원한다.
- 애니메이션 중에도 로그와 타임라인이 같은 정보를 정적으로 제공한다.
- 오류는 색상 외에 아이콘, 제목, 원인/결과 문장으로 표현한다.

## 7. Technical UI contract

- React 19 + TypeScript strict + Vite 8
- CSS Modules와 CSS custom properties
- React UI는 Kafka 결과를 계산하지 않는다.
- 순수 TypeScript 엔진이 결정론적 이벤트 기록을 생성한다.
- 엔진은 Web Worker에서 실행하고 typed union 메시지를 사용한다.
- Zustand vanilla store는 UI/workspace 상태만 관리한다.
- IndexedDB 이름은 `event-city-lab-v1`; 작은 환경 설정은 `ecl:*` localStorage 키를 사용한다.
- 외부 JSON과 저장 데이터 경계는 Zod 4의 비권장되지 않은 API로 검증한다.
- Java 편집기는 CodeMirror 6 core 패키지를 직접 통합한다.
- GitHub Pages base는 `/event-city-lab/`, 라우팅은 hash 기반이다.
- 새 SVG는 `xlink`를 사용하지 않는다.

## 8. Content and asset governance

- 코드: MIT
- 직접 작성한 학습 콘텐츠와 SVG: CC BY 4.0
- 제품명과 로고는 위 라이선스에서 제외한다.
- 외부 리소스는 출처, 라이선스, 수정 여부를 manifest에 기록한다.
- Font Awesome 사용 시 free 아이콘만 사용하며 라이선스 고지를 포함한다.

## 9. Acceptance criteria for Milestone 0

- 첫 진입 기본값에서 메시지 발송이 Serializer 단계에서 실패한다.
- 타임라인, 로그, 월드가 같은 원인과 상태를 일관되게 보여준다.
- 네 단계 힌트가 순서대로 열린다.
- 패널과 제한된 Java 코드가 Serializer 설정을 양방향 동기화한다.
- 설정 수정 후 동일 seed 재실행이 Broker append와 ACK까지 완료된다.
- 실패/성공 실행 비교가 원인, 변경 설정, 결과, trade-off를 보여준다.
- 새로고침 후 진행과 마지막 workspace가 IndexedDB에서 복원된다.
- JSON export/import가 schema validation을 통과한다.
- reduced motion, 키보드 focus, non-color state indicator가 동작한다.
- 타입 검사, 단위 테스트, production build가 통과한다.
- GitHub Pages artifact가 `/event-city-lab/` base에서 생성된다.

## 10. Evidence and open questions

### Evidence

- 저장소 README: 제품명 `Event City Lab`
- 사용자 인터뷰 합의: 실패 우선 학습, 설정 실험, PC 우선, 로컬 저장만 사용, GitHub Pages 독립 배포

### Open questions

없음. Milestone 0 구현에 필요한 결정은 모두 합의되었다.
