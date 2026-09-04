# Continuous Improvement Loop

Status: Active since 2026-09-04

## Goal

2026-09-04의 아키텍처 리뷰와 디자인 리뷰에서 나온 개선 항목을 `BACKLOG.md`에 두고, 사용자가 정한 주기마다 `/backlog-tick`이 항목 하나를 구현·검증·리뷰·커밋해 저장소가 한 걸음씩 나아지게 한다. 파괴적이거나 되돌리기 어려운 행위는 loop가 하지 않는다.

## Trigger

- 사용자가 `/loop <주기> /backlog-tick`을 지정한다. 한 tick이 주기보다 길면 `.omx/tick.lock`이 겹침을 막는다.
- 사용자가 `/backlog-tick B-xx`로 특정 항목을 직접 실행한다.

## Fixed evidence

- 리뷰 원문: `docs/reviews/2026-09-04-architecture-review.html`, `docs/reviews/2026-09-04-design-review.md`
- 항목 근거의 `파일:줄`은 `main` `22455eb` 기준
- 기준선(22455eb): typecheck 통과, vitest 28 files / 148 tests 통과, 시각 baseline 37장(Chromium·darwin)

## Settled invariants

1. backlog는 루트 `BACKLOG.md` 하나다. 항목의 `- meta:` 줄이 유일한 상태 원본이고 파일 순서가 우선순위다. 요약표는 두지 않는다.
2. loop는 저장소 작업 트리의 브랜치 `improve/backlog`에서만 일하고 커밋까지만 한다. worktree는 만들지 않는다. push·PR·merge·rebase와 `main`에서의 커밋은 하지 않는다. main push는 곧 GitHub Pages 배포다. tick은 트리가 깨끗할 때만 브랜치를 `improve/backlog`로 맞추고, 끝난 뒤 `main`으로 되돌리지 않는다.
3. tick당 항목 하나. 항목은 커밋 하나 크기(파일 8개·300줄 안팎)다. 넘으면 쪼개기 제안으로 tick을 끝낸다.
4. sub-agent는 구현자 → 검증자 → 리뷰어 파이프라인이고 모두 `opus`다. 셋은 상한이다. 검증자와 리뷰어는 소스를 고칠 수 없다.
5. 계약은 loop가 바꾸지 않는다. 계약 = AGENTS.md "변경 시 지켜야 할 불변 조건" 전부 + DESIGN.md의 토큰 값·글꼴 조항·레이아웃 치수·자산 규칙·도시 문법. 필요하면 항목을 `blocked`로 두고 DEC 항목을 가리킨다. DEC는 사용자가 loop 밖에서 정한다.
6. 실패한 변경은 버리지 않는다. `blocked`로 표시하고 작업 트리를 더러운 채로 둔다. 다음 tick은 더러운 트리·`in-progress` 잔존·lock·포트 점유를 보면 아무것도 쓰지 않고 멈춘다. 사용자의 작업 중 변경도 같은 이유로 tick을 멈춘다. 정리는 사용자가 한다.
7. main이 앞서가도 merge·rebase하지 않는다. 앞선 커밋 수만 보고한다.
8. 완료 기준: `command npm run typecheck`, `command npm run test:run`, `command npm run build` 통과. UI 항목(유형 design, 또는 `*.css`·`src/components/`·`src/city/`·`src/App*.tsx`·`src/assets/`·`src/domain/chapterSimulation.ts`·`e2e/` 변경)은 추가로 4개 시각 상태(초기·실패·수정 대기·성공) × 3 viewport 캡처와 overflow 계측, `ECL_PORT=4199 command npm run test:e2e` 통과. 새 정적 자산은 `git ls-files --error-unmatch`로 추적 확인(AGENTS.md 규칙 8). `project-details.md` 갱신(AGENTS.md 규칙 9).
9. 시각 baseline은 완료기준에 시각 변경 의도가 적힌 항목만 갱신하고, 리뷰어가 바뀐 챕터·상태가 그 범위인지 확인한다.
10. 커밋 메시지는 저장소 Lore 형식이다. `Tested`에는 검증자의 `result.json` 수치를 그대로 옮기고, `Not-tested`에는 항상 "local node 26.7.0 vs CI node 24"와 "visual baselines are darwin-only"를 적는다. co-author 트레일러는 쓰지 않는다.
11. backlog는 소비 우선이다. 검증 중 발견한 새 결함만 `status=todo` 항목으로 추가할 수 있다. 리뷰 재실행으로 대량 보충하는 것은 사용자가 별도로 켠다.
12. 저장소 `.claude/settings.json`의 `permissions.deny`가 push·merge·rebase·reset·restore·clean·stash drop/clear·worktree remove·branch 삭제·PR 생성을 막는다. 이 설정은 이 저장소의 모든 Claude 세션에 적용된다. push는 터미널에서 직접 한다.

## Setup (한 번)

1. 이 문서·`BACKLOG.md`·`.claude/`·`docs/reviews/`·AGENTS.md·project-details.md 변경은 `improve/backlog` 브랜치의 첫 커밋으로 들어간다(2026-09-04, 첫 tick 직전). `main`에는 사용자가 merge할 때 들어간다.
2. 포트 4173을 점유한 다른 프로젝트 프로세스(`node tools/local-preview.mjs`)는 사용자가 정리한다. e2e는 `ECL_PORT`로 포트를 옮길 수 있어 점유가 재발해도 막히지 않는다.
3. 의존성은 저장소의 `node_modules`를 그대로 쓴다. `engines`는 node 24를 선언하지만 이 머신은 26.7.0이다. CI는 24다.
4. 첫 tick은 사용자가 보는 자리에서 `/backlog-tick B-00`으로 한 번 실행한다. 확인할 것: 브랜치가 `improve/backlog`인지, Lore 형식 커밋, BACKLOG의 B-00 `status=done`, 아래 Tick log 한 줄, `.omx/tick.lock` 없음.
5. 그 뒤 `/loop <주기> /backlog-tick`을 지정한다. loop 중에는 작업 트리에 사용자의 미커밋 변경이 없어야 한다. 있으면 tick은 아무것도 하지 않고 멈춘다.

`ECL_PORT`: `playwright.config.ts`의 `baseURL`·`webServer.url`·`webServer.command`가 이 환경변수의 포트를 쓰고, 기본값은 4173이다. `webServer.command`는 `--strictPort`로 preview를 그 포트에 고정하므로 포트가 차 있으면 조용히 밀리지 않고 실패한다. tick은 `ECL_PORT=4199 command npm run test:e2e`로 돌린다.

## Loop (tick 절차 요약, 상세는 `.claude/skills/backlog-tick/SKILL.md`)

0. 전제 검사. node_modules 존재, 트리 깨끗함, lock 없음, `in-progress` 없음, 4199 비어 있음. 하나라도 걸리면 아무것도 쓰지 않고 보고. 통과하면 브랜치를 `improve/backlog`로 맞춘다(없으면 `main`에서 `--no-track`으로 생성).
1. meta 줄 lint(정규식·ID 중복·미지 dep).
2. 파일 순서 첫 eligible 항목 선택, `in-progress`로 표시.
3. 구현자(opus): 테스트 먼저, 주석 없이, 계약 변경은 정지.
4. 검증자(opus): typecheck·test:run·build, UI면 capture + e2e. `result.json`.
5. 리뷰어(opus, 새 컨텍스트): diff를 완료기준·불변 조건과 대조. 어긋난 지점만.
6. 실패 시 수정 1회 후 4·5 반복. 재실패는 blocked.
7. pass: BACKLOG `done` + 이력, project-details 갱신, Tick log 한 줄, Lore 커밋.
8. blocked: 커밋 없이 더러운 채로 정지, 이유 기록.
9. lock 제거, 보고.

## Checkpoint

DEC-1~6은 사용자가 별도 grilling으로 정한다. 첫 대상은 DEC-4(아키텍처 후보 1의 interface)를 권한다. DEC가 `done`이 되기 전에는 그것에 의존하는 항목은 집히지 않는다.

## Completion evidence

각 tick의 커밋 trailer(`Tested`·`Not-tested`), `BACKLOG.md` 이력 줄, 아래 Tick log. 캡처와 `result.json`은 `.omx/artifacts/backlog/<ID>/`(gitignore)에 남는다.

## Tick log

| 날짜 | tick | 항목 | 결과 | 커밋 | main 앞선 커밋 |
| --- | --- | --- | --- | --- | --- |
| 2026-09-04 | 1 | B-00 | done | 522a451 | 0 |
| 2026-09-04 | 2 | B-01 | done | b5db21d | 0 |
| 2026-09-04 | 3 | B-05 | done | (다음 tick이 채움) | 0 |
