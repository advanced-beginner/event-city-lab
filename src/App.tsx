import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'

import styles from './App.module.css'
import { KafkaWorld } from './components/KafkaWorld'
import {
  APP_VERSION,
  CONTENT_VERSION,
  KAFKA_RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type ComponentId,
  type WorkspaceSnapshot,
} from './domain/simulation'
import { labStore } from './state/labStore'
import {
  loadWorkspace,
  parseWorkspaceJson,
  saveWorkspace,
  serializeWorkspace,
} from './storage/workspaceDb'
import { runSimulation } from './worker/client'

const JavaConfigEditor = lazy(async () => {
  const module = await import('./components/JavaConfigEditor')
  return { default: module.JavaConfigEditor }
})

const HINTS = [
  '관찰: 메시지 상자가 Broker에 도착하기 전에 어느 게이트에서 멈췄는지 확인하세요.',
  '범위: 네트워크 이벤트가 없으므로 Broker나 topic 문제가 아니라 Producer 내부 문제입니다.',
  '원리: Kafka Producer는 value를 전송하기 전에 설정된 Serializer로 byte[]로 바꿉니다. Serializer는 실제 value 타입과 호환되어야 합니다.',
  '수정: value.serializer를 JsonSerializer로 바꾼 뒤 같은 메시지를 다시 실행하세요.',
]

function Icon({ name }: { name: 'play' | 'pause' | 'step' | 'rewind' | 'send' | 'hint' }) {
  const paths = {
    play: <path d="m8 5 11 7-11 7z" />,
    pause: <path d="M7 5h4v14H7zm7 0h4v14h-4z" />,
    step: <path d="m6 5 9 7-9 7zm10 0h3v14h-3z" />,
    rewind: <path d="M7 5v14H4V5zm13 0-10 7 10 7z" />,
    send: <path d="M3 4.5 22 12 3 19.5l3-6 9-1.5-9-1.5z" />,
    hint: <path d="M9 19h6v2H9zm-1-3h8c0-3 3-3.5 3-8a7 7 0 0 0-14 0c0 4.5 3 5 3 8zm4-13a5 5 0 0 1 5 5c0 2.7-1.7 3.2-2.5 5H9.5C8.7 11.2 7 10.7 7 8a5 5 0 0 1 5-5z" />,
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>{paths[name]}</svg>
}

function statusLabel(status: 'failed' | 'succeeded') {
  return status === 'failed' ? '실패' : '성공'
}

export default function App() {
  const state = useStore(labStore)
  const [isRunning, setIsRunning] = useState(false)
  const [saveStatus, setSaveStatus] = useState('저장 대기')
  const [reducedMotion, setReducedMotion] = useState(() => {
    return localStorage.getItem('ecl:reduced-motion') === 'true'
  })
  const importRef = useRef<HTMLInputElement>(null)

  const activeRun = useMemo(
    () => state.runs.find((run) => run.runId === state.activeRunId) ?? null,
    [state.activeRunId, state.runs],
  )
  const activeEvent = activeRun?.events[state.eventCursor] ?? null
  const previousRun = state.runs.length > 1 ? state.runs.at(-2) ?? null : null

  const makeSnapshot = (): WorkspaceSnapshot => ({
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    contentVersion: CONTENT_VERSION,
    kafkaRuleVersion: KAFKA_RULE_VERSION,
    savedAt: new Date().toISOString(),
    config: state.config,
    message: state.message,
    runs: state.runs,
    hintLevel: state.hintLevel,
    chapterCompleted: state.runs.some((run) => run.status === 'succeeded'),
  })

  useEffect(() => {
    if (!window.location.hash) window.location.hash = '#/chapter/1'
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadWorkspace()
      .then((snapshot) => {
        if (!cancelled) labStore.getState().hydrate(snapshot)
      })
      .catch(() => {
        if (!cancelled) {
          labStore.getState().hydrate(null)
          setSaveStatus('로컬 저장소를 열 수 없음')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state.hydrated) return
    setSaveStatus('저장 중…')
    const timeout = window.setTimeout(() => {
      void saveWorkspace(makeSnapshot())
        .then(() => setSaveStatus('이 기기에 저장됨'))
        .catch(() => setSaveStatus('저장 실패'))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [state.config, state.hintLevel, state.hydrated, state.message, state.runs])

  useEffect(() => {
    if (!state.isPlaying || !activeRun) return

    if (state.eventCursor >= activeRun.events.length - 1) {
      labStore.getState().setIsPlaying(false)
      return
    }

    const timeout = window.setTimeout(
      () => labStore.getState().setEventCursor(state.eventCursor + 1),
      reducedMotion ? 180 : 620,
    )
    return () => window.clearTimeout(timeout)
  }, [activeRun, reducedMotion, state.eventCursor, state.isPlaying])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, select, textarea, [contenteditable="true"], .cm-editor')) return
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        void handleRun()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  })

  const handleRun = async () => {
    setIsRunning(true)
    state.setIsPlaying(false)
    try {
      const runNumber = state.runs.length + 1
      const run = await runSimulation({
        runId: `run-${runNumber}-${crypto.randomUUID().slice(0, 8)}`,
        seed: 2401,
        message: state.message,
        config: state.config,
      })
      state.addRun(run)
    } catch (error) {
      state.setEngineError(error instanceof Error ? error.message : '시뮬레이션을 실행하지 못했습니다.')
    } finally {
      setIsRunning(false)
    }
  }

  const handleInspect = (component: ComponentId) => {
    if (component === 'serializer') state.setFocusedSetting('serializer')
    else if (component === 'ack') state.setFocusedSetting('acks')
    else state.setFocusedSetting(null)

    if (!activeRun) return
    const latestIndex = activeRun.events.findLastIndex((event) => event.component === component)
    if (latestIndex >= 0) state.setEventCursor(latestIndex)
  }

  const step = () => {
    if (!activeRun) return
    state.setIsPlaying(false)
    state.setEventCursor(Math.min(activeRun.events.length - 1, state.eventCursor + 1))
  }

  const rewind = () => {
    state.setIsPlaying(false)
    state.setEventCursor(-1)
  }

  const handleExport = () => {
    const blob = new Blob([serializeWorkspace(makeSnapshot())], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'event-city-lab-workspace.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const snapshot = parseWorkspaceJson(await file.text())
      state.replaceWorkspace(snapshot)
      setSaveStatus('가져오기 완료')
    } catch {
      setSaveStatus('가져오기 실패: 파일 형식을 확인하세요')
    }
  }

  const toggleReducedMotion = () => {
    const next = !reducedMotion
    setReducedMotion(next)
    localStorage.setItem('ecl:reduced-motion', String(next))
  }

  return (
    <main className={styles.appShell}>
      <header className={styles.topbar}>
        <div className={styles.brandBlock}>
          <div className={styles.logoMark} aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="m5 17 19-10 19 10-19 10z" /><path d="M5 17v15l19 10V27z" /><path d="M24 27v15l19-10V17z" /></svg>
          </div>
          <div>
            <p className={styles.kicker}>EVENT CITY / CHAPTER 01</p>
            <h1>첫 메시지는 왜 출발하지 못했을까?</h1>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.missionBadge}>MISSION · PRODUCER BOOTCAMP</span>
          <span className={styles.saveState}>{saveStatus}</span>
          <button className={styles.textButton} type="button" onClick={toggleReducedMotion} aria-pressed={reducedMotion}>
            모션 {reducedMotion ? '줄임' : '표준'}
          </button>
          <button className={styles.textButton} type="button" onClick={handleExport}>내보내기</button>
          <button className={styles.textButton} type="button" onClick={() => importRef.current?.click()}>가져오기</button>
          <input
            ref={importRef}
            className={styles.hiddenInput}
            type="file"
            accept="application/json"
            onChange={(event) => void handleImport(event.target.files?.[0])}
          />
        </div>
      </header>

      <section className={styles.briefing} aria-labelledby="briefing-title">
        <div>
          <span className={styles.sectionIndex}>01</span>
          <div>
            <p className={styles.kicker}>BRIEFING</p>
            <h2 id="briefing-title">주문 이벤트를 <code>orders.v1</code>으로 보내세요.</h2>
          </div>
        </div>
        <p>
          성공만 찾지 마세요. 실패 지점, 로그, 관여하지 않은 컴포넌트를 증거로 원인을 설명한 뒤 설정을 고치세요.
        </p>
        <div className={styles.goalStrip}>
          <span>목표</span>
          <strong>Broker append + ACK</strong>
          <span>동일 seed</span>
          <strong>#2401</strong>
        </div>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.controlPanel} aria-label="Producer 설정">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>LOADOUT</p>
              <h2>메시지 & 설정</h2>
            </div>
            <span className={state.config.serializer === 'string' ? styles.dangerBadge : styles.readyBadge}>
              {state.config.serializer === 'string' ? '1 ISSUE' : 'READY'}
            </span>
          </div>

          <section className={styles.messageCard}>
            <div className={styles.cardLabel}><span>MESSAGE CRATE</span><code>{state.message.messageId}</code></div>
            <dl>
              <div><dt>key</dt><dd>{state.message.key}</dd></div>
              <div><dt>value type</dt><dd>OrderEvent</dd></div>
              <div><dt>payload</dt><dd>{JSON.stringify(state.message.value)}</dd></div>
            </dl>
          </section>

          <section
            className={`${styles.settingGroup} ${state.focusedSetting === 'serializer' ? styles.settingFocused : ''}`}
            onMouseEnter={() => state.setFocusedSetting('serializer')}
            onMouseLeave={() => state.setFocusedSetting(null)}
          >
            <label htmlFor="serializer">value.serializer</label>
            <select
              id="serializer"
              value={state.config.serializer}
              onFocus={() => state.setFocusedSetting('serializer')}
              onBlur={() => state.setFocusedSetting(null)}
              onChange={(event) => state.setSerializer(event.target.value as 'string' | 'json')}
            >
              <option value="string">StringSerializer</option>
              <option value="json">JsonSerializer</option>
            </select>
            <p className={state.config.serializer === 'string' ? styles.fieldError : styles.fieldSuccess}>
              {state.config.serializer === 'string'
                ? '◆ OrderEvent와 호환되지 않을 수 있습니다.'
                : '● OrderEvent를 JSON byte[]로 변환합니다.'}
            </p>
          </section>

          <div className={styles.inlineSettings}>
            <div><span>topic</span><strong>{state.config.topic}</strong></div>
            <div><span>acks</span><strong>{state.config.acks}</strong></div>
          </div>

          <div className={styles.editorHeader}>
            <div><p className={styles.kicker}>CODE LINK</p><h3>Producer.java</h3></div>
            <span>설정과 양방향 동기화</span>
          </div>
          <div className={styles.editorFrame}>
            <Suspense fallback={<div className={styles.editorLoading}>코드 편집기 불러오는 중…</div>}>
              <JavaConfigEditor value={state.javaCode} onChange={state.updateCode} />
            </Suspense>
          </div>
          {state.codeWarnings.map((warning) => <p className={styles.fieldError} key={warning}>◆ {warning}</p>)}

          <button className={styles.sendButton} type="button" onClick={() => void handleRun()} disabled={isRunning}>
            <Icon name="send" />
            {isRunning ? '엔진 계산 중…' : state.runs.length ? '같은 메시지 다시 보내기' : '첫 메시지 보내기'}
            <kbd>R</kbd>
          </button>
          {state.engineError && <p className={styles.fieldError} role="alert">{state.engineError}</p>}
        </aside>

        <section className={styles.worldPanel} aria-label="Kafka 시뮬레이션 월드">
          <div className={styles.worldToolbar}>
            <div>
              <span className={styles.liveDot} />
              <strong>PARTITION 0</strong>
              <span>leader: broker-1</span>
            </div>
            <div>
              <span>Serializer 영향</span><i className={styles.legendViolet} />
              <span>실패</span><i className={styles.legendRed} />
              <span>완료</span><i className={styles.legendGreen} />
            </div>
          </div>
          <KafkaWorld
            run={activeRun}
            activeEvent={activeEvent}
            reducedMotion={reducedMotion}
            focusedSetting={state.focusedSetting}
            onInspect={handleInspect}
          />

          {activeRun?.diagnosis && state.eventCursor >= activeRun.events.length - 1 && (
            <article className={styles.incidentCard} aria-labelledby="incident-title">
              <div className={styles.incidentIcon}>×</div>
              <div>
                <p className={styles.kicker}>INCIDENT #SER-001</p>
                <h3 id="incident-title">{activeRun.diagnosis.symptom}</h3>
                <p>{activeRun.summary}</p>
              </div>
              <span className={styles.failureChip}>PRODUCER-SIDE</span>
            </article>
          )}
        </section>
      </div>

      <section className={styles.labConsole} aria-label="실험 타임라인과 장애 분석">
        <div className={styles.playbackBar}>
          <div className={styles.playbackButtons}>
            <button type="button" onClick={rewind} disabled={!activeRun} aria-label="처음으로 되감기"><Icon name="rewind" /></button>
            <button
              type="button"
              disabled={!activeRun}
              onClick={() => state.setIsPlaying(!state.isPlaying)}
              aria-label={state.isPlaying ? '일시정지' : '재생'}
            >
              <Icon name={state.isPlaying ? 'pause' : 'play'} />
            </button>
            <button type="button" onClick={step} disabled={!activeRun} aria-label="한 단계 진행"><Icon name="step" /></button>
          </div>
          <div className={styles.timeline}>
            {(activeRun?.events ?? []).map((event) => (
              <button
                type="button"
                key={event.id}
                className={`${styles.eventNode} ${event.sequence <= state.eventCursor ? styles.eventSeen : ''} ${event.sequence === state.eventCursor ? styles.eventActive : ''} ${event.state === 'failed' ? styles.eventFailed : ''}`}
                onClick={() => {
                  state.setIsPlaying(false)
                  state.setEventCursor(event.sequence)
                }}
                aria-label={`${event.sequence + 1}. ${event.title}`}
              >
                <span>{event.sequence + 1}</span>
                <small>{event.component}</small>
              </button>
            ))}
            {!activeRun && <p>첫 실행 후 이벤트의 정확한 순서가 여기에 기록됩니다.</p>}
          </div>
          <div className={styles.clock}><span>LOGICAL TIME</span><strong>{activeEvent?.atMs ?? 0} ms</strong></div>
        </div>

        <div className={styles.consoleGrid}>
          <section className={styles.logPanel} aria-labelledby="log-title">
            <div className={styles.consoleHeader}><div><p className={styles.kicker}>EVIDENCE A</p><h2 id="log-title">Simulation Log</h2></div><span>{Math.max(0, state.eventCursor + 1)} lines</span></div>
            <ol className={styles.logList}>
              {(activeRun?.events.slice(0, state.eventCursor + 1) ?? []).map((event) => (
                <li key={event.id} className={event.state === 'failed' ? styles.logError : ''}>
                  <time>{String(event.atMs).padStart(4, '0')}ms</time>
                  <code>{event.log}</code>
                </li>
              ))}
              {!activeRun && <li className={styles.emptyLog}>실행 로그가 아직 없습니다.</li>}
            </ol>
          </section>

          <section className={styles.analysisPanel} aria-labelledby="analysis-title">
            <div className={styles.consoleHeader}>
              <div><p className={styles.kicker}>EVIDENCE B</p><h2 id="analysis-title">장애 분석</h2></div>
              <button type="button" className={styles.hintButton} onClick={state.revealHint} disabled={state.hintLevel >= 4}>
                <Icon name="hint" /> 힌트 {state.hintLevel}/4
              </button>
            </div>
            {activeRun?.diagnosis ? (
              <>
                <dl className={styles.diagnosisGrid}>
                  <div><dt>관찰된 증상</dt><dd>{activeRun.diagnosis.symptom}</dd></div>
                  <div><dt>의심 설정</dt><dd><code>value.serializer</code></dd></div>
                  <div><dt>현재 값</dt><dd className={styles.badValue}>{activeRun.diagnosis.currentValue}</dd></div>
                  <div><dt>기대 값</dt><dd className={styles.goodValue}>{activeRun.diagnosis.recommendedValue}</dd></div>
                </dl>
                <div className={styles.hints}>
                  {HINTS.slice(0, state.hintLevel).map((hint, index) => <p key={hint}><span>{index + 1}</span>{hint}</p>)}
                  {state.hintLevel === 0 && <p className={styles.hintEmpty}>로그와 월드에서 증거를 먼저 찾고, 막히면 힌트를 한 단계씩 여세요.</p>}
                </div>
              </>
            ) : activeRun?.status === 'succeeded' ? (
              <div className={styles.successAnalysis}>
                <strong>● 경로 복구 완료</strong>
                <p>{activeRun.summary}</p>
                <p><b>Trade-off:</b> JSON은 구조를 보존하지만 payload 크기와 스키마 관리 비용을 추가합니다.</p>
              </div>
            ) : (
              <p className={styles.emptyAnalysis}>실패가 발생하면 증상, 원인 후보, 설정 연결이 이곳에 나타납니다.</p>
            )}
          </section>

          <section className={styles.comparePanel} aria-labelledby="compare-title">
            <div className={styles.consoleHeader}><div><p className={styles.kicker}>RUN DIFF</p><h2 id="compare-title">실행 비교</h2></div><span>seed #2401</span></div>
            {previousRun && activeRun ? (
              <div className={styles.runComparison}>
                {[previousRun, activeRun].map((run, index) => (
                  <article key={run.runId} className={run.status === 'failed' ? styles.runFailed : styles.runSuccess}>
                    <div><span>RUN {state.runs.length - 1 + index}</span><strong>{statusLabel(run.status)}</strong></div>
                    <p><code>{run.config.serializer === 'string' ? 'StringSerializer' : 'JsonSerializer'}</code></p>
                    <small>{run.status === 'failed' ? 'serializer에서 중단' : 'offset 42 + ACK'}</small>
                  </article>
                ))}
                <div className={styles.diffSummary}>
                  <span>변경</span>
                  <strong>value.serializer</strong>
                  <p>원인은 Broker가 아니라 실제 value 타입과 Serializer의 불일치였습니다.</p>
                </div>
              </div>
            ) : (
              <p className={styles.emptyAnalysis}>실패를 수정하고 같은 메시지를 다시 보내면 두 실행의 차이를 비교합니다.</p>
            )}
          </section>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Event City Lab v{APP_VERSION}</span>
        <span>Content {CONTENT_VERSION}</span>
        <span>Kafka rules {KAFKA_RULE_VERSION}</span>
        <span>학습용 시뮬레이터 · Apache Kafka 및 ASF와 공식 제휴되지 않음</span>
      </footer>
    </main>
  )
}
