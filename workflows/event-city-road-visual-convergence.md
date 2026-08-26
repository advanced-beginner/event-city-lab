# Event City Road Visual Convergence

Status: Complete; approved reference implemented and verified

## Goal

Chapter 2–8을 실제 브라우저에서 반복 검증하며, 모든 챕터가 하나의 8시–2시 중앙 직선도로와 한 대의 Kafka 메시지 차량이라는 동일한 시각 문법으로 수렴하게 한다.

## Trigger

- 사용자가 Chapter 2–8의 시설 배치, 차량 수, 차량 경로 또는 애니메이션 일관성 문제를 보고한다.
- 관련 scene, projection, carrier lifecycle 또는 atlas overlay 코드가 변경된다.

## Fixed evidence

- Source deployment: `https://advanced-beginner.github.io/event-city-lab/`
- Reference interaction grammar: deployed Chapter 1.
- Current failure evidence: deployed Chapter 2 실행 완료 후 carrier 요소 4개가 동시에 잔존한다.
- Captures: `.omx/artifacts/visual-ralph/chapter-road-convergence/`
- Supported verification viewports: `1280×720`, `1440×900`, `1920×1080`.

## Settled invariants

1. Chapter 2–8의 차량은 중앙의 8시–2시 직선도로만 사용한다.
2. 보조 도로, 교차로, 꺾이는 우회 경로는 차량 경로에 포함하지 않는다.
3. 시설은 해당 직선도로에 직접 접한 실제 atlas 건물만 선택한다.
4. 한 시점에 보이는 Kafka 메시지 차량은 정확히 한 대다.
5. 완료된 과거 운송을 별도 차량으로 화면에 누적하지 않는다.
6. Chapter 1의 시설→차량 이동→도착 상태라는 일관된 문법을 Chapter 2–8에도 적용한다.
7. 한 실행에 record가 여러 개면 차량을 증식시키지 않는다. 동일 차량의 순차 운행 또는 학습 효과가 더 좋은 단일-차량 보조 표현을 사용한다.
8. 각 Chapter는 중앙 직선도로에 접한 주요 건물 3~5개만 사용한다. partition, replica, consumer member와 같은 세부 구성요소는 관련 건물 내부의 배지·슬롯·상태로 표현한다.
9. 여러 record는 동일 차량 한 대의 `N records · 순차` batch 표지로 묶는다. 현재 batch의 세부 partition 결과는 Kafka 시설의 논리 배지로 유지한다.
10. ACK, replication, assignment, offset, transaction 같은 제어 신호는 추가 차량을 만들지 않고 짧은 pulse와 건물 내부 상태 배지로 표현한다.
11. 모든 Chapter의 물리적 흐름은 `8시 Source/Producer → 중앙 Kafka/Broker → 2시 Consumer/Application` 방향으로 고정한다. 역방향 ACK와 제어 신호만 반대 방향 pulse로 표현한다.
12. record 도착 후 차량은 다음 record가 시작되거나 타임라인 위치가 바뀔 때까지 목적지에 한 대 정차한다.
13. 실패한 record는 해당 시설에 차량을 정차시키고 오류 표지를 표시한다. 재시도는 같은 차량과 `retry N/M` 표지를 사용하며 출발점으로 순간이동시키지 않는다.
14. Chapter 2–8은 동일한 5개 물리적 role slot을 공유한다: `Source/Producer`, `Kafka ingress/Leader`, `Kafka internal state`, `Consumer/Processor`, `Application/Sink`. 사용하지 않는 slot은 숨긴다.
15. 차량의 시각 속도는 이동 거리에 비례해 일정하게 유지하고, 0.5×·1×·2×가 그 속도를 배율 조정한다.
16. 첫 승인 기준은 Chapter 2 첫 실험의 실패 완료 상태다. 주요 건물만 표시하고, 차량 한 대는 마지막 목적지에 정차하며, p0·p1·p2 결과는 Kafka 건물 내부 배지로 표시한다.
17. 전체 route network는 표시하지 않는다. 승인된 중앙 주도로 전체는 항상 한 줄로 유지하고, 현재 차량이 처리 중인 구간만 그 위에 상태선으로 강조한다.
18. 건물 hit-area polygon은 평상시에 숨긴다. hover, keyboard focus, 현재 활성 상태에서만 실제 building footprint를 따라 외곽선을 표시하고, 역할 표지는 도로를 가리지 않는 건물 상단 또는 측면에 고정한다.
19. 여러 record의 partition 결과는 Kafka 건물 내부 `p0`·`p1`·`p2` 슬롯에 작은 record 번호 배지로 누적한다. 현재 record만 강조하고 이전 결과는 흐리게 유지한다.

## Open decisions

- 없음. 사용자가 `1672×941: (670,550) → (1050,330)`를 Chapter 2–8 공통 중앙 직선도로로 확정했다.
- 첫 구현 checkpoint는 Chapter 2 실험 1 실패 완료 상태이며, 이후 같은 불변 조건으로 Chapter 3–8을 수렴시킨다.

## Proposed loop

1. 배포본과 로컬 production preview에서 Chapter 1 기준 상태와 대상 Chapter의 초기·재생 중·완료 상태를 같은 viewport로 캡처한다.
2. 각 프레임에서 활성 도로 수, 보이는 차량 수, 차량의 도로 중심선 이탈, 시설 hit area와 실제 건물의 일치, 라벨 충돌을 계측한다.
3. 승인된 기준과 Visual Ralph verdict를 비교한다.
4. 실패 원인을 scene geometry, carrier projection/lifecycle, animation timing, overlay styling 중 하나로 분류한다.
5. 한 원인군만 수정하고 targeted test, typecheck, production build를 실행한다.
6. 같은 브라우저 상태를 다시 캡처하고 verdict를 갱신한다.
7. 점수 90 이상이며 모든 불변 조건이 통과할 때까지 3–6을 반복한다.
8. Chapter 2–8 전체와 세 지원 viewport, reduced motion을 최종 회귀 검증한다.

## Checkpoint

구현 전 한 번만 요청한다. Chapter 1의 상호작용 문법과 Chapter 2 atlas의 중앙 직선도로를 결합한 기준 상태를 짧은 brief와 캡처로 제시하고 사용자 승인을 받는다. 승인 후에는 불변 조건을 바꾸는 결정이 없는 한 수정 루프를 자율 실행한다.

## Completion evidence

- 각 Chapter 2–8에서 초기·재생 중·완료 상태 스크린샷.
- 재생 중 모든 샘플에서 visible carrier count `<= 1`.
- 활성 차량 중심점이 승인된 직선도로 corridor 안에 있음.
- 모든 선택 시설의 hit area가 승인된 도로변 건물 footprint와 겹침.
- Visual Ralph verdict score `>= 90`.
- `npm run typecheck`, `npm run test:run`, `npm run build`, 관련 Playwright smoke 통과.
- 남은 차이는 `project-details.md`에 근거와 함께 기록.

## Final verdict — 2026-08-26

- Visual score: `91/100` (pass threshold `>= 90`), 3회 반복에서 `58 → 78 → 91`로 수렴했다.
- Chapter 2–8 in-app browser sampling: carrier count always `1`, rendered route count at most `1`, physical facility count `3–5`.
- Semantic Playwright: Chromium·Firefox·WebKit × `1280×720`·`1440×900`·`1920×1080`, `36/36` passed.
- Visual Playwright: 37 approved Chromium snapshots across initial·failed·succeeded states, `15/15` applicable tests passed (`48` intentionally skipped by project scope).
- Vitest: `28` files, `148` tests passed. Typecheck and production build passed.
- Final overlap fixes keep the approved road coordinates unchanged: control/ACK/transaction은 도로 횡단선을 만들지 않고 상단 status chip과 target pulse를 사용하며, Chapter 8의 transaction boundary는 compact banner로 축소했다.
