# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-08-18
- Product: Event City Lab
- Scope: Milestone 0 — Producer의 첫 메시지 발송, Serializer 실패, 설정 수정, Broker append와 ACK 비교
- Primary evidence: 사용자 제공 기존 화면 캡처, 사용자 승인 단일 Gemini 도시 배경, 본 문서에 기록된 인터뷰 합의
- Asset restriction: 사용자가 최종 배경으로 지정한 첨부 이미지는 최적화된 runtime WebP로만 저장소에 포함한다. 원본 파일은 중복 저장하지 않으며 다른 참고 이미지도 재배포하지 않는다.

## Product intent

Kafka를 처음 배우는 사용자가 설정 이름을 외우는 대신 `설정 → 실행 → 실패 → 증거 조사 → 진단 → 수정 → 동일 조건 재실행 → 비교`를 직접 경험하는 PC 웹 실험실이다. 첫 메시지는 의도적으로 Serializer에서 실패하며, 사용자는 차량이 멈춘 위치, 로그, 컴포넌트 상태와 설정의 연결을 조사해 원인을 설명해야 한다.

Milestone 0의 완료 경험은 다음과 같다.

1. `OrderEvent`와 호환되지 않는 `StringSerializer`로 첫 배송을 시작한다.
2. 노란 배송 차량이 Producer에서 출발해 Serializer 검사소 앞에서 멈춘다.
3. 실패 표지, 로그, 장애 분석과 점진적 힌트로 원인을 찾는다.
4. Serializer를 수정하되 이미 실패한 실행과 증거는 그대로 유지한다.
5. 동일 message와 seed로 재실행해 Broker 기록과 ACK 도착 문자를 확인한다.
6. 실패 실행과 성공 실행의 설정·결과·trade-off를 비교한다.

## Experience principles

- 실패가 먼저다. 성공 경로는 실패를 관찰하고 설정을 고친 뒤 열린다.
- 증거가 정답보다 먼저다. 월드, 타임라인, 로그는 동일한 이벤트 기록을 서로 다른 관점으로 설명한다.
- 설정은 도시에 흔적을 남긴다. 관련 필드와 시설, 경로를 양방향으로 강조한다.
- 실행 기록은 불변이다. 실패 후 설정을 바꾸면 `수정 대기 · 재실행 필요`로 표시하고 과거 실행을 다시 쓰지 않는다.
- 시간은 조사 도구다. 재생, 일시정지, 단계 이동, 되감기, 0.5×/1×/2×를 제공한다.
- 색상만으로 상태를 전달하지 않는다. 형태, 아이콘, 문구, 선 스타일을 함께 사용한다.
- 밝고 실제 도시처럼 보이되 학습 대상만 강하게 반응한다. 장식 건물은 배경이고 Kafka 시설은 조작 가능한 주인공이다.

## Layout

PC 전용 초기 모델이며 지원 범위는 100% 브라우저 확대 기준 `1280 × 720` 이상 `1920 × 1080` 이하이다. 페이지 자체에는 스크롤이 없어야 하고, 긴 코드와 로그만 각 패널 내부에서 스크롤한다.

- Header: 56px. 브랜드, 챕터 제목, 저장 상태, 모션·내보내기·가져오기.
- Mission strip: 44px. 미션 한 문장과 성공 조건.
- Main workspace: 남은 높이를 사용하는 3열 구조.
  - Left: 280px. 메시지 요약과 실행 버튼은 항상 보이며 `설정 / 코드` 탭을 사용한다.
  - Center: fluid. 밝은 SVG 도시와 현재 이벤트 요약.
  - Right: 340px. 현재 이벤트는 고정하고 `로그 / 분석 / 비교` 탭을 사용한다.
- Timeline: 84px 내외. 재생 제어, 속도, 컴포넌트 아이콘과 짧은 이벤트 이름을 가진 수평 노드.
- Footer: 22px. 버전과 비공식 학습 도구 고지.

밀도는 세 단계로 조정한다.

- Compact `1280–1439`: 장식 건물과 수목을 줄이고 패널 여백을 축소한다.
- Standard `1440–1679`: 기본 도시 밀도와 설명량을 사용한다.
- Wide `1680–1920`: 장식 건물과 공원을 모두 표시하고 패널 설명을 넉넉히 보여준다.

## Visual system

### Direction

밝은 golden hour의 실제 도시를 축소한 isometric logistics district다. 도시·도로·장식 건물·공원은 사용자 승인 단일 배경 이미지가 완성된 장면으로 제공한다. 중앙의 큰 건물 세 개를 왼쪽부터 Producer, Serializer, Broker로 매핑하고 클릭 영역, 접근 가능한 이름, 상태 램프·오류·ACK처럼 의미가 바뀌는 정보만 SVG 오버레이로 유지한다.

Visual asset 규칙:

- 2:1 isometric, 64×32 ground tile 기준.
- 명확한 16-bit pixel cluster와 `#302840` 계열 2–3px 외곽선.
- 좌상단 golden light, 우하단 muted-violet contact shadow.
- 도시 배경은 화면 비율에 맞춰 잘라 쓰되 건물 세 개가 모두 보이도록 중앙 정렬한다.
- 시설 표지의 한글·영문은 raster에 굽지 않고 실제 SVG text로 표시한다.
- Producer·Serializer·Broker·노란 메시지 차량이 1차 시각 중심이고 일반 건물은 대비를 한 단계 낮춘다.
- 별도 도로·건물 sprite를 배경 위에 중복 배치하지 않는다. 메시지 checkpoint와 진행 path만 배경 속 중앙 대로의 실제 차선에 맞춘 SVG overlay다.
- 세 Kafka 시설의 상호작용 영역은 배경의 건물 실루엣과 일치해야 하며 인접 도로나 다른 건물을 포함하지 않는다.
- 이동 차량만 투명 PNG sprite를 사용한다. 후면이 좌하단, 전면이 우상단인 방향별 파일을 사용하고 runtime 회전으로 등각 투영 방향을 보정하지 않는다.

### Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#f5f4ef` | 전체 배경 |
| `--surface` | `#ffffff` | 주요 패널 |
| `--surface-muted` | `#f7f8fa` | 코드·로그·보조 영역 |
| `--line` | `#d9dee5` | 경계선 |
| `--ink` | `#243142` | 주요 텍스트 |
| `--ink-muted` | `#66758a` | 보조 텍스트 |
| `--cyan` | `#0ea5a8` | 진행·선택 |
| `--amber` | `#e9a23b` | 메시지·차량 |
| `--red` | `#d84a5b` | 실패·차단 |
| `--green` | `#238a5b` | 성공·완료 |
| `--violet` | `#7656c9` | 설정 영향 |

일반 건물은 sky, mint, coral, sand, lavender 계열의 저채도 pastel을 쓴다. 의미 색상은 시설 외곽선, 도로 신호, 배지, 상태 문구에만 사용한다.

### Typography

- 한국어 UI: Google Fonts `Nanum Gothic`, 400/700/800, `display=swap`.
- UI fallback: `"Apple SD Gothic Neo", "Malgun Gothic", sans-serif`.
- 코드·로그·ID: `ui-monospace`, `SFMono-Regular`, `Menlo`, monospace.
- 본문과 설정: 14–15px. 섹션 제목: 16–20px. 코드·로그: 11–12px.
- Google Fonts 장애 시 fallback으로 전체 기능과 레이아웃이 유지되어야 한다.

### Geometry and elevation

- 기본 spacing: 4, 8, 12, 16, 24px.
- 패널 radius: 12px. 입력과 버튼 radius: 8px.
- 경계는 1px, 선택 상태는 2px focus ring.
- UI 그림자는 낮고 넓게, 도시 오브젝트 그림자는 우하단으로 일관되게 둔다.
- SVG 광원은 좌상단이며 윗면, 좌면, 우면의 명도 순서를 유지한다.

## City and interaction components

### Kafka facilities

- `ProducerHub`: cyan 배송 출발 창고. 표지 `PRODUCER 출발센터`.
- `SerializerCheckpoint`: lavender 화물 검사소. 표지 `SERIALIZER 검사소`.
- `BrokerArchive`: blue 대형 물류·기록 센터. 표지 `BROKER 기록센터`.
- 세 시설만 pointer와 keyboard로 선택할 수 있다. 일반 건물, 공원, 나무는 장식이며 상호작용하지 않는다.

### City composition

Standard view에는 승인된 도시 배경 전체와 중앙 Kafka 핵심 건물 3개가 보인다. 장식 건물·공원·나무·도로는 배경 자체에 포함되며 별도 runtime sprite 수량을 관리하지 않는다.

### Delivery vehicle

- 메시지 이동은 노란 소형 배송 밴 한 대가 담당한다.
- 실행 전 Producer 상차 구역에 주차한다.
- 지붕 또는 번호판에 `order-2401`, 화물 라벨에 `OrderEvent`, 실행 중 `attempt`를 표시한다.
- 정상 재생은 도로를 따라 이동하고 검사소마다 정차한다. 타임라인 직접 선택은 해당 체크포인트로 즉시 이동한다.
- 1× 성공 실행의 화면 재생은 약 4초다.
- reduced motion에서는 체크포인트 사이를 즉시 전환하며 깜빡임, 진동, 도로 흐름 애니메이션을 제거한다.

### Failure state

- Serializer 차단기가 닫히고 차량은 검사소 직전에 멈춘다.
- 화물은 차량에 남고 검사소 이후 도로는 비활성화된다.
- 오류 표지에 `OrderEvent ≠ StringSerializer`를 표시한다.
- ACK 도착 문자는 나타나지 않는다.
- 실패 후 Serializer가 바뀌면 실패 장면을 유지하고 `수정 대기 · 재실행 필요` 배지를 표시한다.

### Success and ACK state

- Serializer 차단기가 열리고 차량이 Broker 하역장에 도착한다.
- Broker가 활성화되고 append 완료 상태를 표시한다.
- ACK는 드론이 아니라 Broker에서 Producer 관제실로 전송되는 통신 신호다.
- ACK 이벤트 이후 Producer에 다음 도착 문자를 표시한다: `orders.v1 / partition 0 / offset 42 저장 완료 · acks=all`.
- ACK 이전으로 되감으면 문자도 사라진다.

## Panels and state transitions

### Left panel

메시지 요약과 실행 버튼은 항상 보인다. `설정` 탭에는 `value.serializer`, topic, acks와 호환성 설명을 제공한다. `코드` 탭에는 CodeMirror Java 설정을 제공하며 양쪽 편집은 같은 config 상태를 갱신한다.

### Right panel

현재 이벤트 제목, 시각, 한 줄 설명은 탭 위에 고정한다.

- `로그`: 현재 cursor까지의 결정론적 로그.
- `분석`: 증상, 의심 설정, 현재·기대 값, 네 단계 힌트.
- `비교`: 이전 실행과 현재 실행의 설정, 실패/성공, 결과와 trade-off.

새 실패 실행이 terminal event에 도달하면 한 번만 `분석`으로 전환한다. 실패를 고친 뒤 성공 실행이 끝나면 한 번만 `비교`로 전환한다. 이후 사용자의 수동 탭 선택을 덮어쓰지 않는다.

### Timeline

각 노드는 component icon, 순번, 짧은 이벤트 이름을 가진다. 본 이벤트 기록의 `atMs`는 logical time이고 0.5×/1×/2×는 화면 재생 간격만 바꾼다. 직접 노드 선택은 재생을 멈추고 즉시 해당 이벤트로 이동한다.

## Accessibility

- WCAG 2.2 AA 대비를 목표로 한다.
- 핵심 실행·설정·재생·탭·시설 선택은 키보드로 가능해야 한다.
- focus ring은 최소 2px이고 색상 외 형태 변화가 함께 있어야 한다.
- SVG에는 title, desc, 시설별 aria-label을 제공한다.
- `prefers-reduced-motion`과 앱 설정을 모두 지원한다.
- 상태는 색상, 아이콘, 문구, 선 스타일로 중복 표현한다.
- 200% 확대는 PC 레이아웃 재배치보다 내부 스크롤 허용을 우선하며 기능 손실이 없어야 한다.

## Technical contract

- React 19, TypeScript strict, Vite 8, CSS Modules, inline SVG.
- 순수 TypeScript 엔진과 Web Worker가 Kafka 결과와 이벤트 기록을 계산한다. React UI는 결과를 재계산하지 않는다.
- Zustand vanilla store는 workspace와 UI 상태를 관리한다.
- IndexedDB `event-city-lab-v1`에 진행을 저장하고 작은 환경 설정은 `ecl:*` localStorage 키를 사용한다.
- 외부 JSON과 저장 데이터는 Zod 4의 비권장되지 않은 API로 검증한다.
- GitHub Pages base는 `/event-city-lab/`, 라우팅은 hash 기반이다.
- SVG는 `xlink`를 사용하지 않으며 시각 요소는 재사용 가능한 속성 기반 컴포넌트 또는 SVG symbol로 구성한다.
- 앱은 Apache Software Foundation 및 Apache Kafka와 공식 제휴되지 않았음을 표시한다.

## Verification contract

시각 검증 상태:

1. 초기 — 차량이 Producer 상차 구역에 주차.
2. 실패 — Serializer 차단, 차량 정지, 오류 표지, 문자 없음.
3. 수정 대기 — 실패 증거 유지, `수정 대기 · 재실행 필요` 표시.
4. 성공 — Broker 하역, 통신 신호, Producer 도착 문자.

각 상태를 `1280 × 720`, `1440 × 900`, `1920 × 1080`에서 확인한다. 성공 기준은 페이지 overflow 없음, 잘린 핵심 문구 없음, 패널·도시·타임라인 중첩 없음, 상태별 차이가 명확함이다. 타입 검사, 단위 테스트, production build와 GitHub Pages base artifact도 통과해야 한다.

## Content and asset governance

- 코드: MIT.
- 직접 작성한 학습 콘텐츠와 SVG: CC BY 4.0.
- 제품명과 로고는 위 라이선스에서 제외한다.
- 외부 참고 자료는 출처와 참고 목적을 생성 기록에 남기며 원본 파일을 재배포하지 않는다.
- 승인된 도시 WebP와 움직이는 Kafka 차량 PNG만 runtime에서 import한다.
- Kafka 시설은 배경 중앙 건물 세 개를 의미적으로 매핑하며, 상태 효과와 실제 텍스트는 프로젝트 고유 SVG다.

## Open questions

없음. Milestone 0 구현에 필요한 제품, 디자인, 인터랙션, 배포 결정은 모두 합의되었다.
