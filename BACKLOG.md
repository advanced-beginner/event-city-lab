# BACKLOG

Event City Lab의 개선 backlog다. 각 항목의 `- meta:` 줄이 유일한 상태 원본이고, 파일 안 순서가 우선순위다. `/backlog-tick`은 위에서부터 첫 `status=todo`이면서 의존이 모두 `done`이고 `type`이 `decision`이 아닌 항목을 집는다. 운영 규칙은 [`workflows/continuous-improvement.md`](./workflows/continuous-improvement.md)에 있다.

읽는 법

- 상태: `todo` → `in-progress` → `done`. 막히면 `blocked`, 버리면 `dropped`. `review`는 사용자가 결과를 보류할 때 쓴다.
- 유형: `fix` 결함, `refactor` 구조, `design` 화면, `decision` 사용자가 정할 것.
- 크기: `S` tick 하나, `M` tick 하나에 커밋 하나이되 파일 8개·300줄 안팎, `L` 착수 전 하위 항목으로 쪼갠다.
- 의존: 모두 `done`이어야 집는다. `-`는 없음.
- 근거의 `파일:줄`은 `main` `22455eb` 기준이다. 리뷰 원문은 [`docs/reviews/`](./docs/reviews/)에 있다.
- 완료기준의 검증 명령은 항상 `command npm …`으로 부른다. 맨 `npm`은 이 환경에서 깨진 셸 함수다.

## 사용자 확인 필요

blocked 항목: 없음

결정 항목은 아래 여섯 개다. loop는 집지 않는다. 사용자가 정하면 `status=done`으로 바꾸고 이력에 결정 내용을 적는다.

### [DEC-1] 디자인 방향을 정한다: A 관제 데스크 / B 야드 표지판
- meta: id=DEC-1 | status=todo | type=decision | size=S | deps=-
- 출처: design-review 방향
- 근거: docs/reviews/2026-09-04-design-review.md "방향"
- 완료기준:
  - [ ] A 또는 B, 또는 A에 B의 요소 일부를 택하고 이유를 이력에 적는다
  - [ ] DESIGN.md 색 토큰·표면 규칙 갱신 범위를 함께 정한다
- 이력:
  - 2026-09-04 생성. 리뷰 추천은 A

### [DEC-2] 글꼴을 정한다: Nanum Gothic 유지 / IBM Plex Sans KR + IBM Plex Mono / Nanum Gothic + Do Hyeon(제목만)
- meta: id=DEC-2 | status=todo | type=decision | size=S | deps=-
- 출처: design-review 방향 A·B 글꼴 절
- 근거: DESIGN.md "Typography", index.html:9-12, THIRD_PARTY_NOTICES.md
- 완료기준:
  - [ ] 글꼴 조합을 택한다. 바꾸면 DESIGN.md 글꼴 조항과 THIRD_PARTY_NOTICES.md 갱신을 B-23 완료기준에 넣는다
- 이력:
  - 2026-09-04 생성. 유지해도 B-12·B-13(크기 체계)은 진행할 수 있다

### [DEC-3] Chapter 2–8 시설 표지 렌더 방식을 정한다: HTML overlay / atlas 좌표 24px 이상
- meta: id=DEC-3 | status=todo | type=decision | size=S | deps=-
- 출처: design-review 진단 1
- 근거: src/components/AdvancedCityWorld.module.css:57-60, docs/reviews/2026-09-04-design-review.md 표 "표지 축소율"
- 완료기준:
  - [ ] 1280×720에서 시설 표지 11px 이상을 만족하는 방식을 택한다
  - [ ] overlay를 택하면 projection이 화면 좌표를 내보내는 seam 변화를 B-24에 적는다
- 이력:
  - 2026-09-04 생성

### [DEC-4] 아키텍처 후보 1의 deepened interface 형태를 정한다
- meta: id=DEC-4 | status=todo | type=decision | size=S | deps=-
- 출처: architecture-review 후보 1
- 근거: src/domain/chapterSimulation.ts:1-4,127-140; src/city/choreography/*.ts
- 완료기준:
  - [ ] event template이 선언하는 "도시 의미"(시설·경로·종결)의 모양과, cue를 projection 쪽에서 만드는 seam 위치를 정한다
  - [ ] design-it-twice로 대안 2개 이상을 비교한 기록을 남긴다
- 이력:
  - 2026-09-04 생성. grilling 첫 대상으로 권고

### [DEC-5] lab session module의 interface를 정한다
- meta: id=DEC-5 | status=todo | type=decision | size=S | deps=-
- 출처: architecture-review 후보 3, design-review 진단 4
- 근거: src/App.tsx:121-197, src/components/GuidedChapterLab.tsx:29-172, src/state/labStore.ts
- 완료기준:
  - [ ] run 요청·증거 보관·playback·저장을 한 module 뒤에 두는 interface(run, seek, play/pause, state)와 두 화면이 알아야 할 최소 정보를 정한다
- 이력:
  - 2026-09-04 생성

### [DEC-6] 좌우 열 폭을 가변으로 허용할지 정한다
- meta: id=DEC-6 | status=todo | type=decision | size=S | deps=-
- 출처: design-review 진단 2
- 근거: DESIGN.md "Layout" (Left 280px, Right 340px), docs/reviews/2026-09-04-design-review.md 표 "레터박스"
- 완료기준:
  - [ ] 중앙 열 폭을 이미지 비율에서 계산하고 남는 폭을 우측 패널에 주는 규칙을 DESIGN.md Layout에 허용할지 정한다
- 이력:
  - 2026-09-04 생성

## 항목

### [B-00] Playwright와 preview 포트를 환경변수로 바꾼다
- meta: id=B-00 | status=done | type=fix | size=S | deps=-
- 출처: continuous-improvement setup (Plan agent 발견 A)
- 근거: playwright.config.ts:27,45-50 (4173 고정); node_modules/playwright-core/lib/coreBundle.js:8521 (재사용 판정 200≤status<404); 이 머신의 4173은 다른 프로젝트 프로세스가 점유
- 완료기준:
  - [x] `playwright.config.ts`의 `baseURL`·`webServer.url`·`webServer.command`가 `process.env.ECL_PORT ?? '4173'`을 쓴다
  - [x] `webServer.command`에 `--strictPort`가 있다
  - [x] `workflows/continuous-improvement.md` Setup에 `ECL_PORT` 사용법 한 줄
  - [x] `ECL_PORT=4199 command npm run test:e2e` 통과, 통과 수를 이력에 기록
  - [x] `command npm run typecheck && command npm run test:run && command npm run build` 통과
- 이력:
  - 2026-09-04 생성
  - 2026-09-04 tick 1 done · playwright.config.ts 포트를 ECL_PORT(기본 4173)로, --strictPort 추가, 단위 테스트 3개 · ECL_PORT=4199 e2e 51 passed / 0 failed / 48 skipped · vitest 29 files / 151 tests · typecheck·build 통과

### [B-01] CityWorld의 preserveAspectRatio prop을 svg에도 적용한다
- meta: id=B-01 | status=done | type=fix | size=S | deps=B-00
- 출처: architecture-review 작은 발견, design-review 진단 2
- 근거: src/components/CityWorld.tsx:35 (svg에 meet 하드코딩) vs :46 (prop은 image에만); e2e/chapter-smoke.spec.ts:226; src/components/KafkaWorld.tsx:83 (slice 요청)
- 완료기준:
  - [x] `<svg preserveAspectRatio>`가 prop 값을 쓴다. Chapter 2–8은 `meet` 그대로
  - [x] Chapter 1 도시가 1280×720·1440×900·1920×1080에서 도구막대 아래 빈 띠 없이 채워진다 (capture로 확인)
  - [x] `KafkaWorld.test.tsx`·`AdvancedCityWorld.test.tsx`에 svg 속성 단언 추가
  - [x] `chapter-smoke.spec.ts:226` 단언이 Chapter 2–8에만 적용됨을 유지
  - [x] 시각 변경 의도: Chapter 1만. Chapter 2–8 baseline 37장은 바뀌지 않는다
  - [x] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성
  - 2026-09-04 tick 2 done · svg가 preserveAspectRatio prop을 따라 Chapter 1이 slice로 채워짐(세 viewport 빈 띠 0px) · slice가 1440×900에서 viewBox 좌우 118단위를 잘라 도시 표지·ACK 말풍선·ACK 히트 영역을 x +104 이동(안전 구간 120–880, 테스트로 고정) · vitest 29 files / 155 tests · ECL_PORT=4199 e2e 51 passed / 0 failed / 48 skipped · 캡처 36장 문제 0 · Chapter 2–8 baseline 불변 · 남은 부작용: ACK 화살표 궤적 일부가 말풍선 뒤를 지남, ACK 히트 영역이 Producer 지붕을 조금 더 덮음

### [B-05] CHOICE_PREVIEWS 누락 14개를 채우고 형제 choice 구별 테스트를 넣는다
- meta: id=B-05 | status=done | type=fix | size=S | deps=-
- 출처: architecture-review 후보 2
- 근거: src/city/chapterScenes.ts:182-240 (EXPERIMENT_PREVIEWS 21, CHOICE_PREVIEWS 28); :237-240 (fallback); src/city/chapterScenes.test.ts:88-97 (non-empty만 검사)
- 완료기준:
  - [x] 누락 14개 추가: assume-no-replay-after-processing, block-poll-past-interval, bound-blocking-retry, handle-revocation-and-assignment, idempotent-replay-then-commit, ignore-ownership-boundary, inspect-current-isr, keep-poll-cadence, publish-dlt-with-context, publish-payload-only, read-committed-to-lso, read-uncommitted-results, retry-in-place-unbounded, trust-replication-factor
  - [x] 테스트: 같은 experiment의 choice들은 preview의 nodeIds 또는 routeIds가 서로 다르다
  - [x] 기존 검사(모든 id가 scene에 존재) 유지
  - [x] 시각 변경 의도: 실행 전 preview만. baseline(initial 상태 캡처)이 바뀌는 챕터는 이력에 적고 갱신한다
  - [x] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성
  - 2026-09-04 tick 3 done · CHOICE_PREVIEWS 28→42(누락 14개 + Chapter 2 partition-local-timeline 형제 중복 보정) · 형제 choice preview 집합 구별 테스트 추가 · vitest 29 files / 162 tests · ECL_PORT=4199 e2e 51 passed / 0 failed / 48 skipped · 캡처 72장 문제 0 · baseline 불변(preview가 화면에 배선되지 않아 바뀔 경로가 없음, B-33)

### [B-02] Chapter 1 오류 표지 폭을 글자 길이에서 계산한다
- meta: id=B-02 | status=todo | type=fix | size=S | deps=B-00
- 출처: design-review 진단 1 부수 결함
- 근거: src/components/KafkaWorld.tsx:107 (rect 186px 고정, 문구 "2 · OrderEvent ≠ StringSerializer" 양끝 잘림)
- 완료기준:
  - [ ] 표지 rect 폭이 문구 길이에서 계산되고 문구가 잘리지 않는다 (1440×900 capture로 확인)
  - [ ] `KafkaWorld.test.tsx`에 전체 문구 렌더 단언
  - [ ] 시각 변경 의도: Chapter 1 실패 상태만
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-03] Chapter 1도 OS prefers-reduced-motion을 JS에서 반영한다
- meta: id=B-03 | status=todo | type=fix | size=S | deps=B-00
- 출처: design-review 진단 4, architecture-review 후보 3 증거
- 근거: src/App.tsx:38-44 (localStorage만); src/components/GuidedChapterLab.tsx:63-69,174-180 (matchMedia 구독); AGENTS.md "prefers-reduced-motion과 앱의 모션 줄임 설정을 유지한다"
- 완료기준:
  - [ ] 두 화면이 같은 helper로 localStorage와 `matchMedia('(prefers-reduced-motion: reduce)')`를 읽고 구독한다
  - [ ] `App.test.tsx`에 matchMedia stub으로 Chapter 1 `reducedMotion` 반영 단언
  - [ ] 헤더 문구 규칙은 GuidedChapterLab과 같게 ("모션 줄임 · OS")
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-04] referenceIds를 KafkaReferenceId로 닫는다
- meta: id=B-04 | status=todo | type=fix | size=S | deps=-
- 출처: design-review 작은 발견, architecture-review 후보 2
- 근거: src/domain/chapterSimulation.ts:78 (`readonly string[]`); src/content/kafkaReferences.ts (KafkaReferenceId)
- 완료기준:
  - [ ] `ChapterExperimentDefinition.referenceIds: readonly KafkaReferenceId[]` (type import만)
  - [ ] `chapterEngine.test.ts`에 모든 referenceId가 `getKafkaReference`로 풀리는 단언
  - [ ] typecheck·test:run·build 통과
- 이력:
  - 2026-09-04 생성

### [B-06] e2e의 항진 단언을 실제 검사로 바꾼다
- meta: id=B-06 | status=todo | type=fix | size=S | deps=B-00
- 출처: design-review 진단 6(city 에이전트 발견)
- 근거: e2e/chapter-smoke.spec.ts:236 (slot 수 == data-city-node 수, 둘은 AdvancedCityWorld.tsx:136,143에서 항상 쌍으로 방출)
- 완료기준:
  - [ ] 단언을 "slot마다 정확히 하나의 `[data-city-node]`이고 slot 수가 3~5"처럼 실패 가능한 검사로 바꾼다
  - [ ] `ECL_PORT=4199 command npm run test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-07] AdvancedCityWorld의 죽은 코드와 안 읽히는 data 속성을 없앤다
- meta: id=B-07 | status=todo | type=refactor | size=S | deps=B-00
- 출처: architecture-review 후보 6 증거
- 근거: src/components/AdvancedCityWorld.tsx:499-534 (layoutCarriers 그룹 분기, projection은 vehicle 키 하나만 만든다: src/city/projection.ts:113-126,148-166); 안 읽히는 속성 data-carrier-route, data-city-boundary-badge, data-route-kind, data-route-state, data-signal-marker
- 완료기준:
  - [ ] `layoutCarriers`가 단일 차량 전제로 단순해진다
  - [ ] 위 5개 속성 제거 전 `grep -rn` 으로 테스트·CSS·e2e에 소비자가 없음을 확인하고 제거
  - [ ] 시각 변경 없음. baseline 불변
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-25] validation.ts의 안 쓰는 export를 닫는다
- meta: id=B-25 | status=todo | type=refactor | size=S | deps=-
- 출처: architecture-review 후보 7 증거
- 근거: src/city/validation.ts export schema 13개 중 12개 외부 import 0 (chapterCityCueSchema만 src/domain/chapterSchemas.ts:3이 사용)
- 완료기준:
  - [ ] 12개 schema의 `export` 제거 (파일 내부 사용 유지)
  - [ ] typecheck·test:run·build 통과
- 이력:
  - 2026-09-04 생성

### [B-26] chapterScenarioSpecs.ts를 정리한다
- meta: id=B-26 | status=todo | type=refactor | size=S | deps=-
- 출처: architecture-review 후보 2
- 근거: src/content/chapterScenarioSpecs.ts (runtime importer 0, 자기 테스트만); project-details.md §3 문장이 이 파일을 가리킴
- 완료기준:
  - [ ] 파일과 테스트 삭제. `accuracyNotes` 문장은 project-details.md §9 "콘텐츠 정확성"으로 옮긴다
  - [ ] project-details.md §3의 참조 문장을 rule module(`src/domain/chapters/`)로 바꾼다
  - [ ] typecheck·test:run·build 통과
- 이력:
  - 2026-09-04 생성

### [B-08] chapter 실행 입력에서 seed를 뺀다
- meta: id=B-08 | status=todo | type=refactor | size=S | deps=B-00
- 출처: architecture-review 후보 5
- 근거: src/domain/chapterSimulation.ts:88,96,122 (읽는 곳 0, 복사만); src/domain/chapterSchemas.ts:17,65; src/components/GuidedChapterLab.tsx:204 (attempts가 seed에 섞임); chapter2~8.test.ts 결정론 테스트 7개(고정 리터럴 두 번 조회)
- 완료기준:
  - [ ] `ChapterSimulationInput`·`ChapterSimulationRun`·schema·worker protocol에서 `seed` 제거
  - [ ] GuidedChapterLab의 seed 계산 제거
  - [ ] 결정론 테스트 7개 삭제. Kafka 내용 단언(예: chapter4.test.ts:71 NotEnoughReplicas)은 유지
  - [ ] Chapter 1의 seed는 그대로 둔다 (AGENTS.md 결정론 불변 조건은 Chapter 1에 적용)
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-10] choreography 테스트를 seam interface로 옮기고 terminal 정의를 하나로 만든다
- meta: id=B-10 | status=todo | type=refactor | size=S | deps=B-00
- 출처: architecture-review 후보 1 준비
- 근거: "terminal" 정의 4곳: src/city/choreography/chapter2_3.ts:396 (kind), chapter4_5.ts:486 (순번), chapter6_8.ts:40 (kind 인라인), src/domain/chapterSimulation.ts:187 (cues.at(-1)); 테스트 3파일이 index.ts를 거치지 않고 production wiring을 재구성 (chapter4_5.test.ts:115-128)
- 완료기준:
  - [ ] `isTerminalEvent(event)` 하나를 choreography가 공유하고 세 파일과 validateChapterRule이 그것을 쓴다
  - [ ] 세 테스트가 `runChapterRule` 결과의 `events[i].cityCue`를 단언한다 (화면이 읽는 필드)
  - [ ] 시각 변경 없음. baseline 불변
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-09] 챕터 authoring helper를 하나로 합친다
- meta: id=B-09 | status=todo | type=refactor | size=S | deps=-
- 출처: architecture-review 후보 5
- 근거: src/domain/chapters/chapter6.ts:7-26 ≡ chapter7.ts:7-26 ≡ chapter8.ts:7-26 (event/diagnosis 복사 3벌); chapter2.ts:369-371·chapter3.ts:414 (runChapterNRule pass-through); 7개 테스트의 validity 블록(validateChapterRule 재진술, chapterEngine.ts:26이 import 시 이미 실행)
- 완료기준:
  - [ ] `src/domain/chapters/authoring.ts`에 `event()`·`diagnosis()` 하나, 7개 rule module이 사용
  - [ ] `runChapter2Rule`·`runChapter3Rule` 삭제, 테스트는 `runChapterRule(rule, input)` 사용
  - [ ] validity 블록 7개 삭제. Kafka 내용 단언 유지
  - [ ] 범용 실험 엔진으로 합치지 않는다 (shallow generic 금지)
  - [ ] typecheck·test:run·build 통과
- 이력:
  - 2026-09-04 생성

### [B-14] 빈 상태와 시스템 설명 문구를 행동 지시로 바꾼다
- meta: id=B-14 | status=todo | type=design | size=S | deps=B-00
- 출처: design-review 진단 6
- 근거: src/App.tsx:427 "실행 로그가 아직 없습니다.", :447 "실패가 발생하면 증상과 설정의 인과 관계를 분석합니다.", :463; src/components/GuidedChapterLab.tsx:355 "아직 이벤트가 없습니다.", :411
- 완료기준:
  - [ ] 빈 상태 문구가 다음 행동을 말한다 (예: "첫 메시지를 보내면 처리 순간이 여기에 쌓입니다. R 키로도 보낼 수 있습니다.")
  - [ ] 시스템 관점 문장을 사용자 관점으로 (예: "실패하면 여기서 원인과 설정의 연결을 찾습니다.")
  - [ ] 관련 단위·e2e 테스트의 문자열 갱신
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-31] 저장소 루트의 테스트 파일을 typecheck 범위에 넣는다
- meta: id=B-31 | status=todo | type=fix | size=S | deps=-
- 출처: tick 1 검증(B-00)에서 발견
- 근거: tsconfig.app.json include는 src만, tsconfig.node.json은 vite.config.ts만이라 playwright.config.ts와 playwright.config.test.ts는 타입 검사를 받지 않는다. src 안에 두면 @types/node 부재(process)와 exactOptionalPropertyTypes 충돌로 6개 오류가 난다
- 완료기준:
  - [ ] playwright.config.ts와 그 단위 테스트가 typecheck 대상에 들어간다 (tsconfig.node.json include 확장 또는 별도 tsconfig). 새 의존성 없이
  - [ ] command npm run typecheck && command npm run test:run && command npm run build 통과
- 이력:
  - 2026-09-04 tick 1 검증 중 발견해 추가

### [B-32] Chapter 1에도 시각 baseline을 둔다
- meta: id=B-32 | status=todo | type=fix | size=S | deps=B-01,B-02
- 출처: tick 2 구현(B-01)에서 발견
- 근거: e2e/chapter-city-visual.spec.ts는 chapter 2–8만 캡처한다. B-01에서 svg slice가 Chapter 1 오버레이를 잘라냈지만 e2e는 잡지 못했다(chapter-smoke의 경계 검사는 viewBox 안 여부만 본다)
- 완료기준:
  - [ ] chapter-city-visual.spec.ts가 Chapter 1의 초기·실패·성공 상태를 1440×900(복잡 챕터 규칙과 같게 1280×720·1920×1080 포함)에서 캡처하는 baseline을 추가한다. CI skip 조건은 기존과 같다
  - [ ] Chapter 1 오버레이(도시 표지·ACK 말풍선·시설 표지)가 화면 안에 온전히 보이는지 e2e에서 getBoundingClientRect로 검사한다
  - [ ] typecheck·test:run·build·ECL_PORT=4199 test:e2e 통과
- 이력:
  - 2026-09-04 tick 2 구현 중 발견해 추가

### [B-33] 실행 전 preview 강조를 화면에 실제로 배선한다
- meta: id=B-33 | status=todo | type=fix | size=S | deps=B-05
- 출처: tick 3 검증(B-05)에서 발견
- 근거: src/components/AdvancedCityWorld.tsx:128이 모든 CityRoute에 previewed={false}를 넘겨 preview.routeIds가 DOM에 닿지 않는다. src/components/AdvancedCityWorld.module.css:47-48의 .previewFacility는 기본값과 같은 값을 다시 지정하는 무동작이다. 눈에 보이는 preview는 Chapter 8 .previewBoundary 하나뿐이다. 그래서 B-05로 preview 데이터를 고쳐도 initial 캡처 72장이 한 장도 바뀌지 않았다
- 완료기준:
  - [ ] cursor < 0이고 events가 비었을 때 preview.routeIds의 route가 previewed로 렌더되고, preview.nodeIds의 시설이 눈에 보이는 강조(색상만이 아닌 선 스타일·표지 포함, AGENTS.md)를 받는다
  - [ ] AdvancedCityWorld.test.tsx에 preview route·facility 렌더 단언
  - [ ] 시각 변경 의도: Chapter 2–8 initial 상태만. initial baseline 갱신, failed·succeeded baseline 불변
  - [ ] typecheck·test:run·build·ECL_PORT=4199 test:e2e 통과
- 이력:
  - 2026-09-04 tick 3 검증 중 발견해 추가

### [B-34] idle 시설의 class 문자열에서 undefined를 없앤다
- meta: id=B-34 | status=todo | type=fix | size=S | deps=-
- 출처: tick 3 검증(B-05)에서 발견
- 근거: src/components/AdvancedCityWorld.tsx의 시설 className에 styles[facility.state]를 그대로 넣어 idle 상태(styles에 .idle 없음)에서 문자열 "undefined"가 렌더된다
- 완료기준:
  - [ ] idle 상태에서 className에 undefined가 들어가지 않는다 (없는 상태 class는 생략)
  - [ ] AdvancedCityWorld.test.tsx에 initial 상태 className 단언
  - [ ] 시각 변경 없음. baseline 불변
  - [ ] typecheck·test:run·build·ECL_PORT=4199 test:e2e 통과
- 이력:
  - 2026-09-04 tick 3 검증 중 발견해 추가

### [B-11] App.module.css의 직접 쓴 색을 토큰으로 바꾼다
- meta: id=B-11 | status=todo | type=design | size=M | deps=B-00
- 출처: design-review 진단 5, 진단 1(대비)
- 근거: src/App.module.css 직접 쓴 6자리 hex 90종, 토큰 사용 104회; AA 미달 회색 #8994a1(3.1:1) #8390a0 #8a98a8 #8491a1 #7b8897; 토큰 --ink-muted #66758a는 4.7:1
- 완료기준:
  - [ ] 같은 값의 토큰으로만 치환한다. 같은 값이 없으면 `src/styles/global.css`에 같은 값으로 토큰을 추가하고 DESIGN.md 색 토큰 표에 기록한다 (값 변경 없음)
  - [ ] 흰 배경에서 4.5:1 미달인 글자색은 `--ink-muted`로 바꾼다 (이것만 시각 변화, 대비 상승)
  - [ ] 파일에 남는 6자리 hex 리터럴 0개 (알파 포함 8자리 그림자 색 제외)
  - [ ] 1280×720·1440×900·1920×1080 capture에서 overflow 없음
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-27] GuidedChapterLab.module.css의 직접 쓴 색을 토큰으로 바꾼다
- meta: id=B-27 | status=todo | type=design | size=M | deps=B-11
- 출처: design-review 진단 5
- 근거: src/components/GuidedChapterLab.module.css 직접 쓴 hex 57종, 토큰 사용 63회
- 완료기준:
  - [ ] B-11과 같은 규칙 (같은 값 토큰, AA 미달 회색은 --ink-muted, 리터럴 0개)
  - [ ] capture overflow 없음, typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-28] KafkaWorld.module.css의 직접 쓴 색을 토큰으로 바꾼다
- meta: id=B-28 | status=todo | type=design | size=S | deps=B-11
- 출처: design-review 진단 5
- 근거: src/components/KafkaWorld.module.css 직접 쓴 hex 15종, 토큰 사용 3회; src/assets/city/palette.json(#302840 등 도시 색)
- 완료기준:
  - [ ] B-11과 같은 규칙. 도시 고유색(#302840 외곽선, #fff5d9 보드)은 `--city-outline` 같은 토큰으로 추가하고 DESIGN.md에 기록
  - [ ] 시각 변경 없음. Chapter 1은 baseline이 없으므로 capture 비교로 확인
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-29] AdvancedCityWorld.module.css의 직접 쓴 색을 토큰으로 바꾼다
- meta: id=B-29 | status=todo | type=design | size=M | deps=B-28
- 출처: design-review 진단 5
- 근거: src/components/AdvancedCityWorld.module.css 직접 쓴 hex 30종, 토큰 사용 0회
- 완료기준:
  - [ ] B-28과 같은 규칙. 값이 같아야 하므로 baseline 37장이 바뀌지 않는다 (바뀌면 실패)
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-12] App.module.css의 글자 크기를 DESIGN.md 범위로 올린다
- meta: id=B-12 | status=todo | type=design | size=M | deps=B-11
- 출처: design-review 진단 1
- 근거: 두 CSS module의 font-size 선언 100개 중 72개가 11px 미만 (8px×23, 9px×31, 10px×18); DESIGN.md Typography: 본문 14–15, 섹션 제목 16–20, 코드·로그 11–12
- 완료기준:
  - [ ] App.module.css에서 본문·설명 14px 이상, 코드·로그·보조 11px 이상, 제목 16–20px. DESIGN.md 범위 밖 크기는 쓰지 않는다 (범위 변경은 DEC 필요)
  - [ ] 1280×720에서 페이지 overflow 없음, 패널 내부 스크롤만 허용 (AGENTS.md 레이아웃 불변 조건)
  - [ ] 핵심 문구 clipping 없음을 3 viewport capture로 확인
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-13] GuidedChapterLab.module.css의 글자 크기를 DESIGN.md 범위로 올린다
- meta: id=B-13 | status=todo | type=design | size=M | deps=B-12,B-27
- 출처: design-review 진단 1
- 근거: src/components/GuidedChapterLab.module.css (8–10px 다수: 로그 8px, 선택지 9px, 푸터 8px)
- 완료기준:
  - [ ] B-12와 같은 규칙과 검증
  - [ ] Chapter 2–8 SVG baseline은 바뀌지 않는다 (이 CSS는 SVG 내부를 칠하지 않음)
- 이력:
  - 2026-09-04 생성

### [B-16] chapterCompleted를 지우고 snapshot을 v3로 올린다
- meta: id=B-16 | status=todo | type=fix | size=M | deps=-
- 출처: architecture-review 후보 3
- 근거: src/components/GuidedChapterLab.tsx:41 (`chapterCompleted: state.runs.some(...)`가 Chapter 1 runs를 읽음); src/App.tsx:155; src/domain/simulation.ts:90; src/domain/schemas.ts:92; src/storage/workspaceDb.ts:113-147 (v1→v2 migration이 이 필드를 읽음); GuidedChapterLab.tsx:99-101은 learningProgress로 완료를 계산
- 완료기준:
  - [ ] `WorkspaceSnapshot`·schema에서 `chapterCompleted` 제거, `STORAGE_SCHEMA_VERSION` 3
  - [ ] v2→v3 migration(필드 제거)과 v1→v3 경로가 `recoverWorkspace` 테스트로 검증된다
  - [ ] 두 화면의 `makeSnapshot`이 필드를 쓰지 않는다
  - [ ] AGENTS.md 저장·버전 규칙(snapshot과 schema 함께 변경, migration 제공, 최대 20개 유지) 준수
  - [ ] typecheck·test:run·build 통과
- 이력:
  - 2026-09-04 생성. chapter run 보존은 B-30에서 B-21 뒤에 한다

### [B-17] worker 왕복 함수를 하나로 합치고 in-thread adapter를 정식화한다
- meta: id=B-17 | status=todo | type=refactor | size=M | deps=B-08
- 출처: architecture-review 후보 4
- 근거: src/worker/client.ts:27-84 vs 86-145 (58줄 중복, 캐스트와 주석 :119-123); 즉석 fake 3곳 client.test.ts:8-47, simulation.worker.test.ts:5-16, GuidedChapterLab.test.tsx:21-29; App.test.tsx는 worker를 mock하지 않음
- 완료기준:
  - [ ] schema 쌍으로 매개화한 왕복 함수 하나. `runSimulation`·`runChapterSimulation`은 그 위의 얇은 호출
  - [ ] `src/worker/inThread.ts`: 같은 시그니처로 엔진을 직접 호출하는 adapter. 테스트가 이것을 import한다
  - [ ] client.test.ts의 listener 정리·requestId 필터·worker 재생성 테스트 유지, chapter 변형 중복(:169-205) 삭제
  - [ ] 캐스트와 주석 소멸
  - [ ] typecheck·test:run·build 통과
- 이력:
  - 2026-09-04 생성

### [B-18] scene 검증을 한 번만 한다
- meta: id=B-18 | status=todo | type=refactor | size=M | deps=B-25,B-00
- 출처: architecture-review 후보 7
- 근거: src/city/validation.ts:271-273 (validateChapterCityCue가 매번 validateCityScene 호출); src/domain/chapterEngine.ts:26 (import 시 183 cue × scene 검증, 두 스레드); src/city/projection.ts:10,44 (렌더마다 재검증); validation.ts:249-255와 chapterScenes.ts:328-334의 roadSlice 중복
- 완료기준:
  - [ ] scene 검증(한 번)과 cue 검사(검증된 scene index에 대한 id 조회)를 분리
  - [ ] projection은 검증된 scene을 받고 재검증하지 않는다
  - [ ] roadSlice 중복 제거
  - [ ] projection.test.ts의 검증 절반(86-145)은 scene 구성 테스트로 이동
  - [ ] 시각 변경 없음. baseline 불변
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-19] projection이 slot 용량과 badge 요약을 결정하고 AdvancedCityWorld는 그리기만 한다
- meta: id=B-19 | status=todo | type=refactor | size=M | deps=B-18,B-07
- 출처: architecture-review 후보 6, design-review 진단 1
- 근거: src/components/AdvancedCityWorld.tsx:270-291 (노드 4개 이상 slot은 badge 버리고 개수 요약); Chapter 6 slot 4·5개, Chapter 7 slot 4개; 접근 이름(:249-253)에는 badge가 모두 들어감; AdvancedCityWorld.test.tsx:149의 `as unknown as` 캐스트
- 완료기준:
  - [ ] world state가 slot별 표지(목록 또는 요약)를 결정하고 컴포넌트는 분기 없이 그린다
  - [ ] slot 용량이 scene 정의에 있고, 초과는 scene 구성 시 실패한다
  - [ ] Chapter 6·7의 badge가 화면에 보이고 접근 이름과 같은 정보를 담는다
  - [ ] `events` prop이 `{ cityCue }`만 요구해 테스트 캐스트가 사라진다
  - [ ] 시각 변경 의도: Chapter 6·7 baseline만 갱신. 나머지 불변
  - [ ] typecheck·test:run·build·`ECL_PORT=4199 test:e2e` 통과
- 이력:
  - 2026-09-04 생성

### [B-15] 중앙 열 폭을 이미지 비율에서 계산하고 현재 사건 판을 이미지 아래에 둔다
- meta: id=B-15 | status=todo | type=design | size=L | deps=DEC-6,B-01,B-13
- 출처: design-review 진단 2
- 근거: 1440×900에서 Chapter 2–8 도시가 패널 높이의 63%(429/678px), Chapter 1 빈 띠 78+78px; docs/reviews/2026-09-04-design-review.md 표 "레터박스"
- 완료기준:
  - [ ] 착수 시 하위 항목으로 분할 (Chapter 1 / Chapter 2–8 / DESIGN.md Layout 갱신)
  - [ ] atlas를 자르지 않는다 (DESIGN.md)
- 이력:
  - 2026-09-04 생성

### [B-21] cue 생성을 domain에서 projection 쪽으로 옮긴다
- meta: id=B-21 | status=todo | type=refactor | size=L | deps=DEC-4,B-10,B-08
- 출처: architecture-review 후보 1 (최우선)
- 근거: src/domain/chapterSimulation.ts:1-4 (city 값 3개 import), :127-140 (cue를 run에 굽는다), :174-193; src/city/choreography/types.ts:1-4 (역방향 type import); experimentId/choiceId 문자열 비교 123회, context.sequence 참조 109회
- 완료기준:
  - [ ] 착수 시 DEC-4 결정에 따라 하위 항목으로 분할
  - [ ] 도메인의 city import 0, run·worker protocol에서 cityCue 제거
- 이력:
  - 2026-09-04 생성

### [B-30] chapter run을 불변 증거로 저장한다
- meta: id=B-30 | status=todo | type=fix | size=M | deps=B-21,B-16
- 출처: architecture-review 후보 3
- 근거: src/components/GuidedChapterLab.tsx:85 (run이 useState에만 존재); AGENTS.md "완료된 SimulationRun은 불변 증거"
- 완료기준:
  - [ ] snapshot에 chapter run(최대 20개) 저장, migration 제공
  - [ ] 저장·복원 round-trip 테스트
- 이력:
  - 2026-09-04 생성

### [B-20] preview를 실험 정의에서 파생한다
- meta: id=B-20 | status=todo | type=refactor | size=M | deps=B-21,B-05
- 출처: architecture-review 후보 2
- 근거: src/city/chapterScenes.ts:182-240 (도메인 id 49개 재타이핑)
- 완료기준:
  - [ ] preview를 각 choice의 첫 cue 또는 experiment 정의에서 파생, 문자열 표 삭제
  - [ ] id를 타입으로 닫는다
- 이력:
  - 2026-09-04 생성

### [B-22] lab session module 하나 뒤에 두 화면을 adapter로 둔다
- meta: id=B-22 | status=todo | type=refactor | size=L | deps=DEC-5,B-16,B-03,B-17
- 출처: architecture-review 후보 3, design-review 진단 4
- 근거: makeSnapshot 중복(App.tsx:145-157, GuidedChapterLab.tsx:29-44); 재생 타이머 120ms/80ms 분기; CSS class 10개 중복; 셸 차이 표 (docs/reviews/2026-09-04-design-review.md 진단 4)
- 완료기준:
  - [ ] 착수 시 DEC-5 결정에 따라 하위 항목으로 분할
- 이력:
  - 2026-09-04 생성

### [B-23] 디자인 방향을 적용한다
- meta: id=B-23 | status=todo | type=design | size=L | deps=DEC-1,DEC-2,B-22,B-13
- 출처: design-review 방향 A/B
- 완료기준:
  - [ ] 착수 시 DEC-1·DEC-2 결정에 따라 하위 항목으로 분할 (토큰, 셸 표면, 눈썹 라벨 제거, 글꼴)
- 이력:
  - 2026-09-04 생성

### [B-24] Chapter 2–8 시설 표지를 1280×720에서 11px 이상으로 만든다
- meta: id=B-24 | status=todo | type=design | size=L | deps=DEC-3,B-19
- 출처: design-review 진단 1
- 근거: atlas 17px 표지가 1280/1440/1920에서 6.0/7.0/10.5px, 배지 12px가 4.2/4.9/7.4px
- 완료기준:
  - [ ] 착수 시 DEC-3 결정에 따라 하위 항목으로 분할
- 이력:
  - 2026-09-04 생성
