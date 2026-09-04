---
name: backlog-tick
description: BACKLOG.md에서 eligible 항목 하나를 골라 improve/backlog 브랜치에서 구현·검증·리뷰·커밋한다. 인자로 항목 ID를 주면 그 항목만 다룬다. /loop <주기> /backlog-tick 으로 반복 실행한다.
argument-hint: "[B-xx]"
---

# backlog-tick

한 번 실행에 BACKLOG 항목 하나를 끝낸다. 규칙의 근거는 `workflows/continuous-improvement.md`다. 이 문서의 절차를 순서대로 따르고, 어느 단계의 정지 조건에 걸리면 그 이후 단계를 하지 않는다.

## 고정값

```
REPO=/Users/benji/Study/event-city-lab
WT=$REPO
BR=improve/backlog
PORT=4199
BACKLOG=$WT/BACKLOG.md
TICK_DIR=$WT/.omx/artifacts/backlog
```

- 작업 트리는 저장소 루트 하나다. worktree를 만들지 않는다. loop는 `$BR` 브랜치에서만 커밋한다.
- 모든 `node`·`npm`·`npx`·`playwright` 호출은 `command npm …`처럼 `command` 접두어를 붙이거나 `$WT/node_modules/.bin/…` 절대 경로로 부른다. 맨 이름은 깨진 셸 함수라 호출 한 번에 약 2만 자의 오류를 뿜는다. 셸 상태는 도구 호출 사이에 남지 않으므로 매 호출마다 붙인다.
- git 명령은 항상 `git -C "$WT" …`로 부른다.
- 인자 `$ARGUMENTS`가 있으면 항목 ID로 해석한다.

## 금지 (어느 단계에서도)

`git push`, PR 생성, `git merge`, `git rebase`, `main` 브랜치에서 커밋, `git reset`, `git checkout -- .`, `git restore`, `git clean`, `git stash drop/clear`, 브랜치·worktree 삭제, `.git` 직접 편집, 배포, 운영 URL 접근, 저장소 밖 파일 변경, 새 의존성 추가, `--update-snapshots`(항목 완료기준에 시각 변경 의도가 적힌 경우만 예외), 계약 변경(AGENTS.md 불변 조건 전부, DESIGN.md의 토큰 값·글꼴 조항·레이아웃 치수·자산 규칙·도시 문법). 저장소 `.claude/settings.json`의 deny 목록이 이 중 일부를 강제한다.

## 0. 전제 검사

하나라도 걸리면 아무것도 쓰지 않고 이유를 보고한 뒤 끝낸다.

```
[ "$(pwd)" = "$REPO" ]
[ -d "$WT/node_modules" ]
[ -z "$(git -C "$WT" status --porcelain)" ]   # 더러우면 정지. 사용자의 작업 중 변경이거나 이전 tick의 blocked 잔여물이다. 정리는 사용자가 한다
[ ! -f "$WT/.omx/tick.lock" ]                 # 다른 tick이 진행 중
! grep -q 'status=in-progress' "$BACKLOG"     # 이전 tick이 죽었다. 자동 초기화 금지
[ -z "$(lsof -nP -iTCP:$PORT -sTCP:LISTEN)" ]
```

트리가 깨끗하면 브랜치를 맞춘다.

```
CURRENT=$(git -C "$WT" rev-parse --abbrev-ref HEAD)
if [ "$CURRENT" != "$BR" ]; then
  if git -C "$WT" show-ref --verify --quiet "refs/heads/$BR"; then git -C "$WT" switch "$BR"
  else git -C "$WT" switch -c "$BR" --no-track main; fi
fi
```

그 뒤:

```
AHEAD=$(git -C "$WT" rev-list --count "$BR..main" 2>/dev/null || echo unknown)
mkdir -p "$WT/.omx" && echo $$ > "$WT/.omx/tick.lock"
```

`AHEAD`는 보고에만 쓴다. merge·rebase는 하지 않는다. tick이 끝나도 브랜치를 `main`으로 되돌리지 않는다. 사용자가 원할 때 `git switch main`한다.

## 1. lint

`grep -n '^- meta:' "$BACKLOG"`의 모든 줄이 다음 정규식과 맞아야 한다.

```
^- meta: id=[A-Z]{1,4}-[0-9]{1,3} \| status=(todo|in-progress|blocked|review|done|dropped) \| type=(fix|refactor|design|decision) \| size=(S|M|L) \| deps=(-|[A-Z]{1,4}-[0-9]{1,3}(,[A-Z]{1,4}-[0-9]{1,3})*)$
```

추가로 ID 중복이 없고, 모든 `deps`의 ID가 어떤 meta 줄의 id로 존재해야 한다. 위반이 있으면 줄 번호와 함께 정지하고 lock을 지운다.

## 2. 항목 선택

meta 줄에서 `id → status` 표를 만든다(DEC 포함). 인자 ID가 있으면 그 항목이 `status=todo`, `type≠decision`, deps 모두 `done`인지 확인한다. 인자가 없으면 파일 순서로 첫 항목을 고른다.

- 후보가 없고 `todo`도 없으면 "backlog 비어 있음"을 보고하고 lock을 지우고 끝낸다.
- `todo`는 있는데 후보가 없으면 "STALLED"와 각 todo를 막는 dep 체인을 보고하고 lock을 지우고 끝낸다.
- 골랐으면 그 항목의 meta 줄에서 `status=todo`를 `status=in-progress`로 바꾼다. 파일만 바꾸고 커밋하지 않는다.

항목 본문(제목·출처·근거·완료기준·이력)을 그대로 `$TICK_DIR/<ID>/item.md`에 저장한다.

## 3. 구현

Agent 도구로 `subagent_type: backlog-implementer`, `model: "opus"`를 띄운다. 프롬프트에 넣을 것:

- `item.md` 전문, `$WT` 절대 경로, 위 "고정값"과 "금지" 절
- AGENTS.md의 "변경 시 지켜야 할 불변 조건"과 "구현 및 검증 절차" 절, DESIGN.md에서 항목과 관련된 절
- 요구: 테스트를 먼저 쓴다. 추가하는 줄에 주석을 쓰지 않는다. 도메인 → worker → store → UI 순서. 변경 파일은 8개·300줄 안팎을 넘지 않는다. 넘을 것 같으면 항목을 쪼개는 제안만 하고 코드를 바꾸지 않는다.
- 계약 변경이 필요하면 코드를 바꾸지 말고 필요한 DEC를 문장으로 보고한다.
- 결과는 변경 파일 목록, 무엇을 왜 바꿨는지, 스스로 실행한 테스트 출력으로 보고한다.

구현자가 "계약 변경 필요" 또는 "쪼개기 필요"를 보고하면 → 8단계의 blocked 경로.

## 4. 검증

Agent 도구로 `subagent_type: backlog-verifier`, `model: "opus"`를 띄운다. 프롬프트에 넣을 것: `item.md`, `$WT`, "고정값", "금지", 그리고 다음 작업.

```
cd "$WT" && command npm run typecheck && command npm run test:run && command npm run build
```

- 새로 import된 정적 자산이 있으면 `git -C "$WT" ls-files --error-unmatch <path>` (AGENTS.md 규칙 8. untracked면 실패).
- UI 항목 판정: `type=design`이거나 `git -C "$WT" diff --name-only`에 `*.css`, `src/components/`, `src/city/`, `src/App*.tsx`, `src/assets/`, `src/domain/chapterSimulation.ts`, `e2e/` 중 하나가 있으면 UI 항목이다.
- UI 항목이면 추가로:
  - `zsh "$WT/.claude/skills/backlog-tick/scripts/capture.sh" <ID>` (빌드 → preview 4199 strict → 초기·실패·수정 대기·성공 × 1280×720·1440×900·1920×1080 캡처 → overflow·오류 계측 → preview 종료)
  - `cd "$WT" && ECL_PORT=$PORT command npm run test:e2e` (B-00 완료 전에는 4173이 비어 있어야 통과한다. 막히면 그 사실을 결과에 적는다)
- 결과를 `$TICK_DIR/<ID>/result.json`에 실제 수치로 기록한다: typecheck 통과 여부, vitest 파일·테스트 수, build 산출물 크기, e2e 통과·실패·skip 수, capture 파일 수와 overflow 여부, 실행 시각. 예측값을 쓰지 않는다.

실패가 있으면 → 5단계 없이 6단계(수정 1회)로.

## 5. 리뷰

Agent 도구로 `subagent_type: backlog-reviewer`, `model: "opus"`를 띄운다. 새 컨텍스트다. 프롬프트에 넣을 것: `item.md`, `$WT`, "금지", AGENTS.md "변경 시 지켜야 할 불변 조건" 절, 계약 파일 목록(`AGENTS.md`, `DESIGN.md`), 그리고 다음 판정 기준.

- `git -C "$WT" diff`와 `git -C "$WT" status --porcelain`만 읽는다.
- 항목의 완료기준 각 줄이 diff에서 충족되는지.
- 추가된 줄(`git -C "$WT" diff -U0 | grep '^+'`)에 주석이 없는지.
- `AGENTS.md`·`DESIGN.md`가 diff에 있으면 그 변경이 "한 일의 기록"인지 "계약 변경"인지. 계약 변경이면 fail.
- `e2e/*-snapshots/`가 status에 있으면 항목 완료기준에 시각 변경 의도가 적혀 있고 바뀐 챕터가 그 범위인지.
- 결과는 `pass` 또는 `fail`과 어긋난 지점만. 칭찬과 범위 밖 제안은 쓰지 않는다.

## 6. 수정 1회

4 또는 5가 실패하면 구현자를 한 번 더 띄워 실패 내용을 그대로 전달하고 고치게 한다. 그 뒤 4와 5를 다시 한다. 두 번째도 실패하면 → 8단계의 blocked 경로.

## 7. 마무리 (pass일 때만)

1. `git -C "$WT" status --porcelain`을 읽고 다음을 확인한다: `e2e/*-snapshots/` 변경은 의도된 항목만, `dist/`·`.omx/`·`node_modules/`는 나오지 않는다(gitignore), 저장소 밖 경로는 없다.
2. `$BACKLOG`에서 항목 meta를 `status=done`으로, 이력에 `- <날짜> tick <n> done · <요약 한 줄>`을 추가한다. "사용자 확인 필요"의 blocked 목록을 meta 줄에서 다시 만든다(`status=blocked` ID들, 없으면 "없음").
3. `$WT/project-details.md`를 갱신한다: 완료 범위, 새로 드러난 미비점(있으면 BACKLOG에도 `status=todo` 항목으로 추가. 이 tick의 커밋에 포함).
4. `$WT/workflows/continuous-improvement.md`의 Tick log 표에 한 줄: 날짜 · tick 번호 · ID · done · 커밋 칸은 `(다음 tick이 채움)` · AHEAD. 같은 단계에서 바로 위 줄의 커밋 칸이 `(다음 tick이 채움)`이면 `git -C "$WT" log -1 --format=%h`(현재 HEAD, 곧 이전 tick의 커밋)로 채운다. 자기 커밋의 hash는 커밋 안에 들어갈 수 없으므로 이렇게 한 tick 늦게 채운다.
5. 커밋 메시지를 `$TICK_DIR/<ID>/message.txt`에 쓴다. 첫 줄은 의도를 설명하는 한 문장(`[B-xx]` 접두어), 빈 줄, 본문 3~5줄, 그 다음 trailer는 다음 일곱 종만 쓴다: `Constraint`, `Rejected`, `Confidence`, `Scope-risk`, `Directive`, `Tested`, `Not-tested`. `Tested`는 `result.json`의 수치를 그대로 옮긴다. `Not-tested`에는 항상 "local node 26.7.0 vs CI node 24"와 "visual baselines are darwin-only"를 넣는다. co-author 트레일러는 쓰지 않는다.
6. `git -C "$WT" add -A && git -C "$WT" commit -F "$TICK_DIR/<ID>/message.txt"`
7. 커밋 뒤 `git -C "$WT" rev-parse --short HEAD`를 최종 보고에 적는다. `--amend`는 쓰지 않는다.

## 8. blocked 경로

- `$BACKLOG`의 항목 meta를 `status=blocked`로 바꾸고 이력에 이유(실패한 명령의 마지막 출력 요약, 또는 필요한 DEC)를 적는다.
- 커밋하지 않는다. 변경을 버리지 않는다. 작업 트리는 더러운 채로 둔다. 다음 tick은 0단계에서 멈추고, 정리는 사용자가 한다.

## 9. 종료

```
rm -f "$WT/.omx/tick.lock"
```

`.omx/tick.lock` 제거는 pass·blocked·정지 모든 경로에서 마지막에 한 번 한다(0단계에서 걸린 경우는 만들지 않았으므로 제외). 마지막 메시지에 적을 것: 항목 ID와 제목, 결과(done/blocked/STALLED/빈 backlog/정지 이유), 커밋 hash, 현재 브랜치, `AHEAD`, `status=blocked` 항목 목록, 사용자가 해야 할 일.
