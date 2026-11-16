# Design

## Source of truth

- Status: Active
- Last refreshed: 2026-09-09
- Product: Event City Lab
- Scope: Chapter 1–8 — 실패 중심 Kafka 실험, 증거 조사, 수정과 재실행
- Primary evidence: 사용자 제공 기존 화면 캡처, Chapter 1 승인 도시 배경, Chapter 2–8 승인 고해상도 도시 atlas, 본 문서에 기록된 인터뷰 합의
- Asset restriction: 사용자가 지정한 이미지는 최적화된 runtime WebP로만 저장소에 포함한다. 원본 파일은 중복 저장하지 않으며 다른 참고 이미지도 재배포하지 않는다.

## Product intent

Kafka를 처음 배우는 사용자가 설정 이름을 외우는 대신 `설정 → 실행 → 실패 → 증거 조사 → 진단 → 수정 → 동일 조건 재실행 → 비교`를 직접 경험하는 PC 웹 실험실이다. 첫 메시지는 의도적으로 Serializer에서 실패하며, 사용자는 차량이 멈춘 위치, 로그, 컴포넌트 상태와 설정의 연결을 조사해 원인을 설명해야 한다.

Milestone 0의 완료 경험은 다음과 같다.

1. `OrderEvent`와 호환되지 않는 `StringSerializer`로 첫 배송을 시작한다.
2. 노란 배송 차량이 Producer에서 출발해 Serializer 검사소 앞에서 멈춘다.
3. 실패 표지, 로그, 장애 분석과 점진적 힌트로 원인을 찾는다.
4. Serializer를 수정하되 이미 실패한 실행과 증거는 그대로 유지한다.
5. 동일 message와 seed로 재실행해 Broker 기록과 ACK 도착 문자를 확인한다.
6. 실패 실행과 성공 실행의 설정·결과·trade-off를 비교한다.

Chapter 2–8은 같은 학습 반복과 도시 문법을 공통 guided lab으로 확장한다. 각 챕터는 정확히 세 실험을 제공하며, 사용자는 실제 atlas 건물과 도로 위에서 시설 선택 → record·ticket 이동 → 실패 지점 → ACK·commit·assignment·transaction 제어 신호를 관찰한다. 권장 설정을 적용해도 과거 실행은 보존되며 재실행 후 성공 결과를 비교한다. 완료 진도는 브라우저 로컬에 저장하고 모든 실험을 마친 뒤에도 sandbox 방식으로 재실행할 수 있다.

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

밝은 미니어처 워크스페이스(`#f5f4ef`) 위에 고대비 딥 슬레이트 단면 받침대(Cutaway Base)와 모듈형 Isometric 우편 물류 건물·도로망을 올린 **Pure Isometric Vector Diorama**다. Chapter 1부터 Chapter 8까지 외부 비트맵 배경에 의존하지 않고 동일한 2:1 등각 그리드(`src/city/isometric.ts`)와 `IsometricDioramaStage` 렌더러로 일관된 Look & Feel을 제공한다.

Visual & Geometry 규칙:

- 2:1 isometric grid (`tileHalfW=58, tileHalfH=29`) 및 `1600×900` 표준 viewBox.
- 3-Point Shading: 모든 입체 블록은 윗면(100%), 좌측면(82%), 우측면(64%) 명도 차이와 미세 베벨 하이라이트, 바닥 접촉 그림자를 적용한다.
- Diorama Cutaway Base: 딥 슬레이트 상판(`#263349`~`#162032`)과 2단 지층 단면 벽체로 입체 받침대를 구성한다.
- 챕터별 모듈형 스테이지: Chapter 1–8은 각각 필요한 Kafka 거점(Producer, Serializer, Broker/Partitions, Followers, Consumer/Coordinator, Retry Loop, DLT Vault, Offset Store, TX Coordinator)을 최적의 Waypoint Graph로 배치한다.
- 모션 그래픽: 챕터 진입 시 Staggered Z-axis Extrusion(`cubic-bezier(0.22, 1, 0.36, 1)`), 호버/포커스 시 Z축 부유(Levitation), 상단 컨트롤 바의 `핵심 도로 / 전체 지도` 및 `조립 뷰 / 분해 뷰(Exploded View)` 토글을 지원한다(`prefers-reduced-motion` 시 모션 제거).
- 모든 시설 표지의 한글·영문과 화물 배지는 실제 SVG `<text>`로 선명하게 렌더링한다.
- 우편 배송 차량(`IsometricPostalVan`)은 진행 방향(`ne`, `se`, `sw`, `nw`)에 맞춰 3D 등각 폴리곤으로 직접 생성하며, 외부 PNG 스프라이트를 사용하지 않는다.

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
- 활성 Kafka 시설만 pointer와 keyboard로 선택할 수 있다. 일반 건물, 공원, 나무는 장식이며 상호작용하지 않는다.

### City composition

Chapter 1부터 Chapter 8까지 모든 챕터는 공통 inline SVG 디오라마 렌더러 `IsometricDioramaStage`와 키보드 조작 가능한 `CityFacility`, 그리고 통합 워크스페이스 CSS(`LabWorkspace.module.css`)를 공유한다.

각 챕터의 `CitySceneDefinition`은 2D Isometric Grid 좌표에 배치된 물리 건물(`physicalFacilities`), 논리 노드(`nodes`), 그리고 시작 노드의 출구에서 교차점을 거쳐 도착 노드의 입구까지 0px 오차로 이어지는 유향 도로(`routes`)를 정의한다. scene validator(`src/city/validation.ts`)는 모든 경로의 양 끝점이 해당 `fromNode`/`toNode` 좌표와 일치하는지, 모든 체크포인트가 경로 폴리라인 위에 놓이는지 검증한다.

- **A → B → C 연속 주행 및 회차:** `src/city/projection.ts`와 `guidedPlayback.ts`는 단조 증가 직선 제약을 사용하지 않고, 이벤트 시퀀스의 실제 `routeId`와 연결 그래프 경로(`resolveTransitionPolyline`)를 따라 차량을 주행시킨다. Chapter 7의 `application → retry-1m → retry-10m → application` 회차 루프나 DLT 격리 분기도 실제 도로를 따라 자연스럽게 주행한다.
- **파티션 및 복제 다중 분기:** Chapter 2의 key 미지정 분산(`p0/p1/p2`)이나 Chapter 3/4의 복제(`Leader → Follower 1/2`)처럼 다중 `carrierChanges`가 발생하면, 갈라지는 분기 차선마다 개별 우편 차량(`vehicle`, `branch-1`, `branch-2`)을 투영해 분산 흐름을 직접 보여준다.
- **광섬유 제어 신호 및 차단기:** ACK, Commit, Assignment, Transaction 등 제어/회신 신호는 도로 위 광섬유 라인의 `stroke-dashoffset` 펄스로 표현한다. 실패·ISR 부족·LSO 경계에서는 도로 위에 물리 차단봉(`IsometricBarrier`)이 닫힌다.
- **분해 뷰(Exploded View):** 상단 토글로 건물 기단·본체·지붕을 Z축으로 분리해 내부 논리 코어와 슬롯 구조를 관찰할 수 있다.

### Chapter 2–8 도시 표시

- 시설 표지는 한글 역할명을 먼저, Kafka 명칭을 함께 표시한다. 현재 관련 논리 노드와 요약 상태를 제공하고 상세 목록은 조사 영역에 둔다.
- 실행 전 선택지 preview는 관련 시설·논리 노드를 강조한다. 같은 물리 건물을 공유하는 선택지도 차이 설명으로 구분하며 결과를 미리 노출하지 않는다.
- ACK·commit·transaction·수정 대기·차단 사유는 지도 위쪽에 항상 확보한 고정 영역에 표시한다. 상태 칩이 줄바꿈해도 SVG 지도와 겹치거나 카메라 표시 범위가 바뀌지 않는다. 차량·시설·차단기의 세계 좌표는 유지한다.
- terminal 사건은 이동과 반복 효과를 끝내되 실제 마지막 checkpoint를 보존한다. 관찰형 실험의 차량을 억지로 도로 끝까지 이동시키거나 모든 시설을 완료로 바꾸지 않는다. 업무 실패와 학습 조건 충족은 원래 사건 의미대로 구분한다.
- 설정 수정은 기존 사건 기록과 실패 장면을 유지한다. 되감으면 아직 발생하지 않은 오류·반환 신호·완료 문구는 보이지 않는다.

### Delivery vehicle

- 메시지 이동은 노란 소형 배송 밴 한 대가 담당한다.
- 실행 전 Producer 상차 구역에 주차한다.
- 지붕 또는 번호판에 `order-2401`, 화물 라벨에 `OrderEvent`, 실행 중 `attempt`를 표시한다.
- 정상 재생은 승인된 직선도로의 ordered points를 보간한 SVG transform으로 이동하고 시설마다 정차한다. Chapter 2–8은 하나의 재생 clock이 사건과 차량 progress를 관리한다. 1× 기준 화면 이동속도는 240px/s, 사건별 정차 200ms, 최소 사건 표시시간 500ms다. 0.5×/1×/2×는 표시 시간만 바꾼다. 일시정지는 현재 이동 위치를 유지하고 재개 시 남은 구간을 이어간다. 타임라인 직접 선택·시설 조사·한 단계는 해당 체크포인트로 즉시 이동하며, 처음은 cursor -1이다. 새 실행은 시작 위치로 즉시 복귀하고 이전 실행에서 역주행하지 않는다.
- Chapter 1의 1× 성공 실행은 약 4초다. Chapter 2–8의 총 재생 시간은 사건 수와 실제 화면 이동거리에 따라 달라진다.
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
- 시설을 클릭하거나 Enter/Space로 선택하면 재생을 멈추고 현재 cursor까지 관찰된 해당 시설의 최신 이벤트로 이동한다. Chapter 2–8은 물리 시설의 모든 논리 노드에서 최신 사건을 찾으며 건물 focus ID는 고정한다. 조사 영역에서 내부 논리 노드를 따로 선택할 수 있다. 아직 관찰된 이벤트가 없으면 시설 역할을 설명하고 미래로 건너뛰지 않는다.
- 200% 확대는 PC 레이아웃 재배치보다 내부 스크롤 허용을 우선하며 기능 손실이 없어야 한다.

## Technical contract

- React 19, TypeScript strict, Vite 8, CSS Modules, inline SVG.
- 순수 TypeScript 엔진과 Web Worker가 Kafka 결과와 이벤트 기록을 계산한다. React UI는 결과를 재계산하지 않는다.
- `ChapterEventTemplate.cityCue`의 모든 node·route·checkpoint 참조는 scene validator와 Zod Worker schema를 통과해야 한다. 좌표는 scene에만 있고 엔진 이벤트에는 이동 의미와 식별자만 있다.
- `CitySceneDefinition`은 2D Isometric Grid 좌표와 시설(`physicalFacilities`), 논리 노드(`nodes`), 유향 연결 도로(`routes`), 체크포인트(`checkpoints`)를 소유하며 모든 경로는 `fromNode`와 `toNode`를 정확히 연결한다.
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

Chapter 2–8 이동 변경은 route geometry 단위 테스트로 누적 거리 보간·bend·역방향·반복 좌표를 검증한다. 브라우저 smoke는 실제 carrier transform이 승인된 도로 위에서 전진하는지, 정지 후 좌표가 유지되는지, 재실행 시 초기화되는지 확인한다. 핵심 도로/전체 지도 전환 시 원본 배경 좌표는 같아야 하며, 근접 보기의 주요 시설명과 현재 상태는 화면상 최소 12px로 읽혀야 한다.

## Content and asset governance

- 코드: MIT.
- 직접 작성한 학습 콘텐츠와 SVG: CC BY 4.0.
- 제품명과 로고는 위 라이선스에서 제외한다.
- 모든 도시 디오라마 아트워크와 차량·시설 그래픽은 외부 비트맵 이미지 없이 프로젝트 자체 순수 SVG 코드로 생성한다.

## Open questions

없음. Milestone 0 구현에 필요한 제품, 디자인, 인터랙션, 배포 결정은 모두 합의되었다.
