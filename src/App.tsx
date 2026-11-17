import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'

import type { AdvancedCityViewMode } from './city/camera'
import { getChapterOneScene } from './city/chapterScenes'
import { createChapterOneCuedEvents } from './city/projection'
import type { CitySize } from './city/types'
import { ChapterNavigation } from './chapters/ChapterNavigation'
import { getChapter, type ChapterMetadata } from './chapters/registry'
import {
  ActionGuideBanner,
  GuidedChapterLab,
  LearningBriefingCard,
  LearningTakeawayCard,
  StepTracker,
  type LearningStep,
} from './components/GuidedChapterLab'
import {
  carrierProgressAtCursor,
  createPlaybackSegment,
  createPlaybackSnapshots,
  interpolatePlaybackProgress,
  retimePlaybackSegment,
  type PlaybackSpeed,
} from './components/guidedPlayback'
import { IsometricDioramaStage } from './components/IsometricDioramaStage'
import { chapterOneScenarioSpec } from './content/chapterScenarioSpecs'
import { kafkaReferences } from './content/kafkaReferences'
import {
  APP_VERSION,
  CONTENT_VERSION,
  KAFKA_RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type ComponentId,
  type SimulationEvent,
  type WorkspaceSnapshot,
} from './domain/simulation'
import { useChapterRoute } from './routing/chapterRoute'
import { labStore } from './state/labStore'
import {
  loadWorkspace,
  parseWorkspaceJson,
  saveWorkspace,
  serializeWorkspace,
  type WorkspaceRecoveryFailureReason,
} from './storage/workspaceDb'
import styles from './styles/LabWorkspace.module.css'
import { runSimulation } from './worker/client'

const JavaConfigEditor = lazy(async () => {
  const module = await import('./components/JavaConfigEditor')
  return { default: module.JavaConfigEditor }
})

type LeftTab = 'settings' | 'code'
type EvidenceTab = 'logs' | 'analysis' | 'comparison'

function readReducedMotionPreference(): boolean {
  try {
    return window.localStorage.getItem('ecl:reduced-motion') === 'true'
  } catch {
    return false
  }
}

const HINTS = [
  '관찰: 배송 차량이 Broker에 도착하기 전에 어느 검사소에서 멈췄는지 확인하세요.',
  '범위: 네트워크 출발 이벤트가 없으므로 Broker나 topic보다 Producer 내부를 먼저 조사하세요.',
  '원리: Producer는 value를 전송하기 전에 Serializer로 byte[]로 바꿉니다. 실제 value 타입과 호환되어야 합니다.',
  '수정: value.serializer를 JsonSerializer로 바꾼 뒤 같은 메시지를 다시 실행하세요.',
]

const EVENT_LABELS: Record<SimulationEvent['kind'], string> = {
  'command.accepted': '발송 접수',
  'producer.preparing': '상차 준비',
  'serializer.inspecting': '화물 검사',
  'serializer.rejected': '검사 거부',
  'serializer.completed': '검사 통과',
  'network.dispatched': '도시 이동',
  'broker.received': 'Broker 도착',
  'broker.appended': '로그 기록',
  'ack.returned': '도착 문자',
  'run.completed': '실행 완료',
}

function Icon({ name }: { name: 'play' | 'pause' | 'step' | 'rewind' | 'send' | 'hint' | 'settings' | 'code' | 'log' | 'analysis' | 'compare' }) {
  const paths = {
    play: <path d="m8 5 11 7-11 7z" />,
    pause: <path d="M7 5h4v14H7zm7 0h4v14h-4z" />,
    step: <path d="m6 5 9 7-9 7zm10 0h3v14h-3z" />,
    rewind: <path d="M7 5v14H4V5zm13 0-10 7 10 7z" />,
    send: <path d="M3 4.5 22 12 3 19.5l3-6 9-1.5-9-1.5z" />,
    hint: <path d="M9 19h6v2H9zm-1-3h8c0-3 3-3.5 3-8a7 7 0 0 0-14 0c0 4.5 3 5 3 8zm4-13a5 5 0 0 1 5 5c0 2.7-1.7 3.2-2.5 5H9.5C8.7 11.2 7 10.7 7 8a5 5 0 0 1 5-5z" />,
    settings: <path d="M4 6h10v2H4zm0 10h16v2H4zm14-12h2v6h-2zM8 12h2v6H8zm-4 1h16v2H4z" />,
    code: <path d="m9 5-7 7 7 7 1.5-1.5L5 12l5.5-5.5zm6 0-1.5 1.5L19 12l-5.5 5.5L15 19l7-7z" />,
    log: <path d="M5 4h14v16H5zm3 4h8V6H8zm0 4h8v-2H8zm0 4h6v-2H8z" />,
    analysis: <path d="M4 19h16v2H4zm2-2 4-5 3 2 5-8 2 1-6 10-3-2-3 4z" />,
    compare: <path d="M7 4 2 9l5 5v-3h6V7H7zm10 6v3h-6v4h6v3l5-5z" />,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>{paths[name]}</svg>
}

function statusLabel(status: 'failed' | 'succeeded') {
  return status === 'failed' ? '실패' : '성공'
}

function workspaceRecoveryStatus(error: unknown): string {
  const reason = (
    typeof error === 'object'
    && error !== null
    && 'result' in error
    && typeof error.result === 'object'
    && error.result !== null
    && 'reason' in error.result
  ) ? error.result.reason as WorkspaceRecoveryFailureReason : null

  switch (reason) {
    case 'unsupported-newer-version':
      return '더 새로운 저장 데이터 · 가져오기로 복구 필요'
    case 'unsupported-older-version':
      return '이전 저장 데이터 · migration 필요'
    case 'invalid-json':
    case 'invalid-snapshot':
    case 'missing-storage-schema-version':
    case 'invalid-storage-schema-version':
      return '손상된 저장 데이터 · 가져오기로 복구 필요'
    default:
      return '로컬 저장소를 열 수 없음'
  }
}

export default function App() {
  const { chapterId } = useChapterRoute()
  const chapter = getChapter(chapterId)

  return chapter.id === 1
    ? <ChapterOneLab chapter={chapter} />
    : <GuidedChapterLab key={chapter.id} chapter={chapter} />
}

function ChapterOneLab({ chapter }: { chapter: ChapterMetadata }) {
  const state = useStore(labStore)
  const [isRunning, setIsRunning] = useState(false)
  const [saveStatus, setSaveStatus] = useState('저장 대기')
  const [storageBlocked, setStorageBlocked] = useState(false)
  const [leftTab, setLeftTab] = useState<LeftTab>('settings')
  const [evidenceTab, setEvidenceTab] = useState<EvidenceTab>('logs')
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [reducedMotion, setReducedMotion] = useState(readReducedMotionPreference)
  const [viewMode, setViewMode] = useState<AdvancedCityViewMode>('focus')
  const [exploded, setExploded] = useState(false)
  const [viewportSize, setViewportSize] = useState<CitySize>({ width: 1280, height: 720 })
  const [carrierProgress, setCarrierProgress] = useState(0)
  const [playbackPulse, setPlaybackPulse] = useState(0)

  const importRef = useRef<HTMLInputElement>(null)
  const autoSwitchedRunId = useRef<string | null>(null)
  const cityViewportRef = useRef<HTMLDivElement | null>(null)
  const carrierProgressRef = useRef(0)
  const playbackFrameRef = useRef<number | null>(null)
  const activeSegmentRef = useRef<ReturnType<typeof createPlaybackSegment>>(null)
  const activeSegmentSettingsKeyRef = useRef('')
  const segmentStartedAtRef = useRef(0)
  const segmentLastTimestampRef = useRef(0)
  const segmentElapsedRef = useRef(0)

  const scene = useMemo(() => getChapterOneScene(), [])

  const activeRun = useMemo(
    () => state.runs.find((run) => run.runId === state.activeRunId) ?? null,
    [state.activeRunId, state.runs],
  )
  const activeRunIndex = activeRun ? state.runs.findIndex((run) => run.runId === activeRun.runId) : -1
  const activeEvent = activeRun?.events[state.eventCursor] ?? null
  const previousRun = activeRunIndex > 0 ? state.runs[activeRunIndex - 1] ?? null : null
  const isTerminal = Boolean(activeRun && state.eventCursor >= activeRun.events.length - 1)
  const isPendingRerun = Boolean(
    activeRun?.status === 'failed' && activeRun.config.serializer !== state.config.serializer,
  )
  const chapterOneExperimentSpec = chapterOneScenarioSpec.experiments[0]
  const chapterOneReferences = kafkaReferences.filter((reference) =>
    chapterOneScenarioSpec.references.includes(reference.id),
  )
  const currentStep: LearningStep = isPendingRerun
    ? 3
    : activeRun && isTerminal && activeRun.status === 'failed'
      ? 2
      : activeRun && isTerminal && activeRun.status === 'succeeded'
        ? 4
        : activeRun && state.eventCursor >= 0
          ? 2
          : 1
  const currentSerializerLabel = state.config.serializer === 'string' ? 'StringSerializer' : 'JsonSerializer'
  const actionGuide: {
    tone: 'ready' | 'failed' | 'pending' | 'succeeded'
    title: string
    detail: string
  } = isPendingRerun
    ? {
        tone: 'pending',
        title: '바뀐 설정으로 다시 보내세요',
        detail: 'JsonSerializer가 적용 대기 중입니다. 아래 [같은 메시지 다시 보내기]로 재실행하세요.',
      }
    : activeRun && isTerminal && activeRun.status === 'failed'
      ? {
          tone: 'failed',
          title: '원인을 읽고 value.serializer를 변경하세요',
          detail: "우측 [분석] 탭에서 실패 지점을 확인한 뒤 'JsonSerializer'로 바꾸세요.",
        }
      : activeRun && isTerminal && activeRun.status === 'succeeded'
        ? {
            tone: 'succeeded',
            title: '핵심 교훈과 Trade-off를 확인하세요',
            detail: '우측 [비교]·[분석] 탭에서 Serializer 실행 위치와 JSON Trade-off를 확인하세요.',
          }
        : activeRun && state.eventCursor >= 0
          ? {
              tone: 'ready',
              title: '메시지 이동과 이벤트를 관찰하세요',
              detail: '타임라인 끝까지 재생하거나 마지막 사건을 눌러 처리 결과를 확인하세요.',
            }
          : state.config.serializer === 'string'
            ? {
                tone: 'ready',
                title: '현재 설정 그대로 첫 메시지를 보내 보세요',
                detail: 'StringSerializer 상태에서 [첫 메시지 보내기]를 눌러 어느 지점에서 멈추는지 관찰하세요.',
              }
            : {
                tone: 'ready',
                title: 'JsonSerializer로 첫 메시지를 보내 보세요',
                detail: 'OrderEvent가 JSON byte[]로 직렬화되어 Broker와 ACK까지 도달하는지 확인하세요.',
              }

  const cuedEvents = useMemo(
    () => createChapterOneCuedEvents(activeRun, isPendingRerun),
    [activeRun, isPendingRerun],
  )
  const playbackSnapshots = useMemo(
    () => createPlaybackSnapshots(scene, cuedEvents),
    [cuedEvents, scene],
  )

  const ackVisible = Boolean(
    activeRun
    && state.eventCursor >= 0
    && activeRun.events
      .slice(0, state.eventCursor + 1)
      .some((event) => event.component === 'ack' && (event.state === 'active' || event.state === 'complete')),
  )

  const setCarrierProgressValue = (progress: number) => {
    carrierProgressRef.current = progress
    setCarrierProgress(progress)
  }

  const clearPlaybackSegment = () => {
    activeSegmentRef.current = null
    activeSegmentSettingsKeyRef.current = ''
    segmentElapsedRef.current = 0
    if (playbackFrameRef.current !== null) window.cancelAnimationFrame(playbackFrameRef.current)
    playbackFrameRef.current = null
  }

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
    learningProgress: state.learningProgress,
  })

  useEffect(() => {
    let cancelled = false
    void loadWorkspace()
      .then((snapshot) => {
        if (!cancelled) labStore.getState().hydrate(snapshot)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          labStore.getState().hydrate(null)
          setStorageBlocked(true)
          setSaveStatus(workspaceRecoveryStatus(error))
        }
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!state.hydrated || storageBlocked) return
    setSaveStatus('저장 중…')
    const timeout = window.setTimeout(() => {
      void saveWorkspace(makeSnapshot())
        .then(() => setSaveStatus('이 기기에 저장됨'))
        .catch(() => setSaveStatus('저장 실패'))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [state.config, state.hintLevel, state.hydrated, state.learningProgress, state.message, state.runs, storageBlocked])

  useEffect(() => {
    const element = cityViewportRef.current
    if (!element) return
    const measure = () => {
      const world = element.querySelector('svg')
      setViewportSize({
        width: world?.clientWidth || element.clientWidth || 1280,
        height: world?.clientHeight || element.clientHeight || 720,
      })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Sync carrierProgress cleanly when paused / stepped / seeked externally
  useEffect(() => {
    if (state.isPlaying) return
    clearPlaybackSegment()
    setCarrierProgressValue(carrierProgressAtCursor(scene, cuedEvents, state.eventCursor, playbackSnapshots))
  }, [cuedEvents, playbackSnapshots, scene, state.eventCursor, state.isPlaying])

  // Unified RAF playback clock for smooth A -> B -> C van motion
  useEffect(() => {
    if (!state.isPlaying || !activeRun) return

    const settingsKey = `${speed}:${viewMode}:${viewportSize.width}:${viewportSize.height}:${reducedMotion}`
    let segment = activeSegmentRef.current
    if (!segment) {
      segment = createPlaybackSegment({
        currentProgress: carrierProgressRef.current,
        cursor: state.eventCursor,
        events: cuedEvents,
        scene,
        speed,
        snapshots: playbackSnapshots,
        viewMode,
        viewportSize,
      })
      if (!segment) {
        labStore.getState().setIsPlaying(false)
        return
      }
      activeSegmentRef.current = segment
      activeSegmentSettingsKeyRef.current = settingsKey
      segmentElapsedRef.current = 0
      labStore.getState().setEventCursor(segment.toCursor)
    } else if (activeSegmentSettingsKeyRef.current !== settingsKey) {
      const retimedSegment = retimePlaybackSegment({
        currentProgress: carrierProgressRef.current,
        elapsedMs: segmentElapsedRef.current,
        events: cuedEvents,
        previousSegment: segment,
        scene,
        speed,
        snapshots: playbackSnapshots,
        viewMode,
        viewportSize,
      })
      if (!retimedSegment) {
        labStore.getState().setIsPlaying(false)
        return
      }
      segment = retimedSegment
      activeSegmentRef.current = retimedSegment
      activeSegmentSettingsKeyRef.current = settingsKey
      segmentElapsedRef.current = 0
    }

    if (!segment) {
      labStore.getState().setIsPlaying(false)
      return
    }

    let startedAt: number | null = null
    const tick = (timestamp = window.performance.now()) => {
      if (startedAt === null) {
        startedAt = timestamp
        segmentStartedAtRef.current = timestamp
      }
      segmentLastTimestampRef.current = timestamp
      const elapsedMs = segmentElapsedRef.current + timestamp - startedAt
      setCarrierProgressValue(interpolatePlaybackProgress(segment, elapsedMs, reducedMotion))
      if (elapsedMs >= segment.totalDurationMs) {
        setCarrierProgressValue(segment.toProgress)
        activeSegmentRef.current = null
        activeSegmentSettingsKeyRef.current = ''
        segmentElapsedRef.current = 0
        if (segment.toCursor >= activeRun.events.length - 1) {
          labStore.getState().setIsPlaying(false)
        } else {
          setPlaybackPulse((value) => value + 1)
        }
        return
      }
      playbackFrameRef.current = window.requestAnimationFrame(tick)
    }

    playbackFrameRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (playbackFrameRef.current !== null) window.cancelAnimationFrame(playbackFrameRef.current)
      playbackFrameRef.current = null
      if (activeSegmentRef.current) {
        segmentElapsedRef.current += Math.max(0, segmentLastTimestampRef.current - segmentStartedAtRef.current)
      }
    }
  }, [activeRun, cuedEvents, playbackPulse, playbackSnapshots, reducedMotion, scene, speed, state.isPlaying, viewMode, viewportSize])

  useEffect(() => () => {
    if (playbackFrameRef.current !== null) window.cancelAnimationFrame(playbackFrameRef.current)
  }, [])

  useEffect(() => {
    if (!activeRun || !isTerminal || autoSwitchedRunId.current === activeRun.runId) return
    autoSwitchedRunId.current = activeRun.runId
    setEvidenceTab(activeRun.status === 'failed' ? 'analysis' : previousRun ? 'comparison' : 'logs')
  }, [activeRun, isTerminal, previousRun])

  const handleRun = async () => {
    setIsRunning(true)
    clearPlaybackSegment()
    setCarrierProgressValue(0)
    state.setIsPlaying(false)
    setEvidenceTab('logs')
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

  const handleInspect = (nodeId: string) => {
    const component = nodeId as ComponentId
    if (component === 'serializer') state.setFocusedSetting('serializer')
    else if (component === 'ack') state.setFocusedSetting('acks')
    else state.setFocusedSetting(null)
    clearPlaybackSegment()
    state.setIsPlaying(false)
    if (!activeRun || state.eventCursor < 0) return
    const latestIndex = activeRun.events
      .slice(0, state.eventCursor + 1)
      .findLastIndex((event) => event.component === component)
    if (latestIndex >= 0) {
      state.setEventCursor(latestIndex)
    }
  }

  const step = () => {
    if (!activeRun) return
    clearPlaybackSegment()
    state.setIsPlaying(false)
    state.setEventCursor(Math.min(activeRun.events.length - 1, state.eventCursor + 1))
  }

  const rewind = () => {
    clearPlaybackSegment()
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
      setStorageBlocked(false)
      setSaveStatus('가져오기 완료')
    } catch (error: unknown) {
      setSaveStatus(`가져오기 실패 · ${workspaceRecoveryStatus(error)}`)
    }
  }

  const toggleReducedMotion = () => {
    const next = !reducedMotion
    setReducedMotion(next)
    try {
      window.localStorage.setItem('ecl:reduced-motion', String(next))
    } catch {
      // Best-effort storage persistence.
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brandBlock}>
          <div className={styles.logoMark} aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="m5 17 19-10 19 10-19 10z" /><path d="M5 17v15l19 10V27z" /><path d="M24 27v15l19-10V17z" /></svg>
          </div>
          <div>
            <p className={styles.kicker}>EVENT CITY · CHAPTER {chapter.numberLabel}</p>
            <h1>{chapter.title}</h1>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <ChapterNavigation activeChapterId={chapter.id} />
          <span className={styles.missionBadge}>PRODUCER BOOTCAMP</span>
          <span className={styles.saveState}><span aria-hidden="true">●</span> {saveStatus}</span>
          <button className={styles.motionButton} type="button" onClick={toggleReducedMotion} aria-pressed={reducedMotion}>모션 {reducedMotion ? '줄임' : '표준'}</button>
          <button className={styles.textButton} type="button" onClick={handleExport}>내보내기</button>
          <button className={styles.textButton} type="button" onClick={() => importRef.current?.click()}>가져오기</button>
          <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json" onChange={(event) => void handleImport(event.target.files?.[0])} />
        </div>
      </header>

      <section className={styles.missionStrip} aria-labelledby="briefing-title">
        <div className={styles.missionPrimary}>
          <span className={styles.sectionIndex}>01</span>
          <div>
            <div className={styles.missionTitle}>
              <span className={styles.purposeTag}>실험 목적</span>
              <h2 id="briefing-title">주문 이벤트를 <code>orders.v1</code>으로 보내세요.</h2>
            </div>
            <p>실패 지점과 로그를 증거로 원인을 찾고, 설정을 고친 뒤 같은 조건으로 재실행하세요.</p>
          </div>
        </div>

        <div className={styles.misconceptionBox}>
          <span>⚠️ 흔한 오해</span>
          <p>{chapterOneScenarioSpec.misconception}</p>
        </div>

        <StepTracker stepLabels={['설정·실행', '원인 진단', '설정 수정', '교훈 확인']} currentStep={currentStep}>
          <div className={styles.goalStrip}><span>목표</span><strong>Broker append + ACK</strong><span>seed</span><strong>#2401</strong></div>
        </StepTracker>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.controlPanel} aria-label="메시지와 Producer 설정">
          <div className={styles.panelHeader}>
            <div><p className={styles.kicker}>LOADOUT</p><h2>메시지 & 설정</h2></div>
            <span className={state.config.serializer === 'string' ? styles.dangerBadge : styles.readyBadge}>{state.config.serializer === 'string' ? '1 ISSUE' : 'READY'}</span>
          </div>

          <section className={styles.messageCard}>
            <div className={styles.cardLabel}><span>MESSAGE</span><code>{state.message.messageId}</code></div>
            <dl>
              <div><dt>key</dt><dd>{state.message.key}</dd></div>
              <div><dt>value</dt><dd>OrderEvent · ₩{state.message.value.amount.toLocaleString('ko-KR')}</dd></div>
              <div><dt>customer</dt><dd>{state.message.value.customer}</dd></div>
            </dl>
          </section>

          <div className={styles.tabs} role="tablist" aria-label="설정과 코드">
            <button role="tab" aria-selected={leftTab === 'settings'} className={leftTab === 'settings' ? styles.tabActive : ''} onClick={() => setLeftTab('settings')}><Icon name="settings" />설정</button>
            <button role="tab" aria-selected={leftTab === 'code'} className={leftTab === 'code' ? styles.tabActive : ''} onClick={() => setLeftTab('code')}><Icon name="code" />코드</button>
          </div>

          <div className={styles.leftTabBody}>
            {leftTab === 'settings' ? (
              <>
                <section className={`${styles.settingGroup} ${state.focusedSetting === 'serializer' ? styles.settingFocused : ''}`}>
                  <label htmlFor="serializer">value.serializer</label>
                  <select id="serializer" value={state.config.serializer} onFocus={() => state.setFocusedSetting('serializer')} onBlur={() => state.setFocusedSetting(null)} onChange={(event) => state.setSerializer(event.target.value as 'string' | 'json')}>
                    <option value="string">StringSerializer</option>
                    <option value="json">JsonSerializer</option>
                  </select>
                  <p className={state.config.serializer === 'string' ? styles.fieldError : styles.fieldSuccess}>
                    {state.config.serializer === 'string' ? '✕ OrderEvent와 타입이 맞지 않습니다.' : '✓ OrderEvent를 JSON byte[]로 변환합니다.'}
                  </p>
                </section>
                <div className={styles.inlineSettings}>
                  <div><span>topic</span><strong>{state.config.topic}</strong></div>
                  <div><span>acks</span><strong>{state.config.acks}</strong></div>
                </div>
                <article className={styles.learningNote}>
                  <strong>왜 출발 전에 멈출까요?</strong>
                  <p>Serializer는 네트워크 요청을 만들기 전에 Producer 안에서 실행됩니다. 타입 변환이 실패하면 Broker에는 아무 요청도 도착하지 않습니다.</p>
                </article>
              </>
            ) : (
              <>
                <div className={styles.editorHeader}><div><p className={styles.kicker}>CODE LINK</p><h3>Producer.java</h3></div><span>설정과 양방향 동기화</span></div>
                <div className={styles.editorFrame}><Suspense fallback={<div className={styles.editorLoading}>코드 편집기 불러오는 중…</div>}><JavaConfigEditor value={state.javaCode} onChange={state.updateCode} /></Suspense></div>
                {state.codeWarnings.map((warning) => <p className={styles.fieldError} key={warning}>✕ {warning}</p>)}
              </>
            )}
          </div>

          {isPendingRerun && <div className={styles.pendingBadge}><span>↻</span><div><strong>수정 대기</strong><small>재실행해야 새 설정이 적용됩니다.</small></div></div>}
          <ActionGuideBanner
            tone={actionGuide.tone}
            title={actionGuide.title}
            detail={actionGuide.detail}
          />
          <button className={styles.primaryRunButton} type="button" onClick={() => void handleRun()} disabled={isRunning}>
            <Icon name="send" /><span>{isRunning ? '엔진 계산 중…' : state.runs.length ? '같은 메시지 다시 보내기' : '첫 메시지 보내기'}</span><kbd>R</kbd>
          </button>
          {state.engineError && <p className={styles.fieldError} role="alert">{state.engineError}</p>}
        </aside>

        <section className={styles.worldPanel} aria-label="Kafka 메시지 물류 도시" ref={cityViewportRef}>
          <IsometricDioramaStage
            scene={scene}
            events={cuedEvents}
            cursor={state.eventCursor}
            attempt={Math.max(1, activeRunIndex + 1)}
            {...(state.isPlaying ? { carrierProgress } : {})}
            isPlaying={state.isPlaying}
            {...(activeRun && isTerminal && !state.isPlaying ? { runStatus: activeRun.status } : {})}
            reducedMotion={reducedMotion}
            focusedSetting={state.focusedSetting}
            pendingRerun={isPendingRerun}
            exploded={exploded}
            viewMode={viewMode}
            viewportSize={viewportSize}
            showChapterOneAckBubble={ackVisible}
            onToggleExploded={() => setExploded((value) => !value)}
            onViewModeChange={setViewMode}
            onInspect={handleInspect}
          />
          <div className={`${styles.worldStatus} ${activeEvent?.state === 'failed' ? styles.worldStatusFailed : ''}`}>
            <span>{activeEvent?.state === 'failed' ? '!' : activeEvent ? '●' : '○'}</span>
            <div>
              <strong>{isPendingRerun ? '설정은 바뀌었지만 이 실행은 그대로입니다.' : activeEvent?.title ?? '첫 배송을 기다리는 중'}</strong>
              <small>{isPendingRerun ? '같은 메시지를 다시 보내 변경 결과를 비교하세요.' : activeEvent?.detail ?? '노란 우편 배송 차량이 Producer 출발센터에 주차되어 있습니다.'}</small>
            </div>
          </div>
        </section>

        <aside className={styles.evidencePanel} aria-label="실험 증거">
          <div className={styles.currentEvent}>
            <div><p className={styles.kicker}>CURRENT EVENT</p><span>{activeEvent ? `${String(activeEvent.sequence + 1).padStart(2, '0')} / ${String(activeRun?.events.length ?? 0).padStart(2, '0')}` : '00 / 00'}</span></div>
            <h2>{activeEvent?.title ?? '실행 전'}</h2>
            <p>{activeEvent?.detail ?? '메시지를 보내면 모든 처리 순간이 여기에 기록됩니다.'}</p>
            <time>{activeEvent?.atMs ?? 0} ms</time>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="로그, 분석, 비교">
            <button role="tab" aria-selected={evidenceTab === 'logs'} className={evidenceTab === 'logs' ? styles.tabActive : ''} onClick={() => setEvidenceTab('logs')}><Icon name="log" />로그</button>
            <button role="tab" aria-selected={evidenceTab === 'analysis'} className={evidenceTab === 'analysis' ? styles.tabActive : ''} onClick={() => setEvidenceTab('analysis')}><Icon name="analysis" />분석</button>
            <button role="tab" aria-selected={evidenceTab === 'comparison'} className={evidenceTab === 'comparison' ? styles.tabActive : ''} onClick={() => setEvidenceTab('comparison')}><Icon name="compare" />비교</button>
          </div>

          <div className={styles.evidenceBody}>
            {evidenceTab === 'logs' && (
              <>
                <LearningBriefingCard
                  question={chapterOneExperimentSpec?.failureOrQuestion ?? chapter.learningGoal}
                  criteria={chapter.learningGoal}
                  currentConfigLabel={currentSerializerLabel}
                />
                <ol className={styles.logList}>
                  {(activeRun?.events.slice(0, state.eventCursor + 1) ?? []).map((event) => (
                    <li key={event.id} className={event.state === 'failed' ? styles.logError : ''}><time>{String(event.atMs).padStart(4, '0')}</time><code>{event.log}</code></li>
                  ))}
                  {!activeRun && <li className={styles.emptyState}>실행 로그가 아직 없습니다.</li>}
                </ol>
                <div className={styles.references}>
                  <span>Kafka {KAFKA_RULE_VERSION} 근거</span>
                  {chapterOneReferences.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>)}
                </div>
              </>
            )}

            {evidenceTab === 'analysis' && (
              <div>
                {activeRun?.diagnosis ? (
                  <>
                    <div className={styles.analysisHeadline}><span>!</span><div><strong>{activeRun.diagnosis.symptom}</strong><p>{activeRun.summary}</p></div></div>
                    <dl className={styles.diagnosisGrid}>
                      <div><dt>의심 설정</dt><dd><code>value.serializer</code></dd></div>
                      <div><dt>현재 값</dt><dd className={styles.badValue}>{activeRun.diagnosis.currentValue}</dd></div>
                      <div><dt>기대 값</dt><dd className={styles.goodValue}>{activeRun.diagnosis.recommendedValue}</dd></div>
                      <div><dt>Broker 요청</dt><dd>발생하지 않음</dd></div>
                    </dl>
                    <div className={styles.repairActionBox}>
                      <span>🔧 지금 수정해야 할 설정</span>
                      <div className={styles.repairDiffGrid}>
                        <div><small>실패한 현재 값</small><strong className={styles.badValue}>{activeRun.diagnosis.currentValue}</strong></div>
                        <div><small>권장 수정 값</small><strong className={styles.goodValue}>{activeRun.diagnosis.recommendedValue}</strong></div>
                      </div>
                      <button type="button" onClick={() => state.setSerializer('json')}>권장 설정(JsonSerializer) 바로 적용</button>
                    </div>
                    <button type="button" className={styles.hintButton} onClick={state.revealHint} disabled={state.hintLevel >= 4}><Icon name="hint" />힌트 {state.hintLevel}/4 열기</button>
                    <div className={styles.hints}>{HINTS.slice(0, state.hintLevel).map((hint, index) => <p key={hint}><span>{index + 1}</span>{hint}</p>)}</div>
                  </>
                ) : activeRun?.status === 'succeeded' ? (
                  <>
                    <div className={styles.successCard}><strong>✓ 경로 복구 완료</strong><p>{activeRun.summary}</p><p><b>Trade-off:</b> JSON은 구조를 보존하지만 payload 크기와 스키마 관리 비용을 추가합니다.</p></div>
                    <LearningTakeawayCard
                      conclusion={chapterOneExperimentSpec?.repairOrConclusion ?? activeRun.summary}
                      tradeOff="JSON은 구조를 보존하고 디버깅이 쉽지만, 문자열 직렬화보다 payload 크기와 스키마 관리 비용이 커집니다."
                      accuracyNotes={chapterOneScenarioSpec.accuracyNotes}
                    />
                  </>
                ) : <p className={styles.emptyState}>실패가 발생하면 증상과 설정의 인과 관계를 분석합니다.</p>}
                <div className={styles.references}>
                  <span>Kafka {KAFKA_RULE_VERSION} 근거</span>
                  {chapterOneReferences.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>)}
                </div>
              </div>
            )}

            {evidenceTab === 'comparison' && (
              <div>
                {activeRun?.status === 'succeeded' && (
                  <LearningTakeawayCard
                    conclusion={chapterOneExperimentSpec?.repairOrConclusion ?? activeRun.summary}
                    tradeOff="JSON은 구조를 보존하고 디버깅이 쉽지만, 문자열 직렬화보다 payload 크기와 스키마 관리 비용이 커집니다."
                    accuracyNotes={chapterOneScenarioSpec.accuracyNotes}
                  />
                )}
                {previousRun && activeRun ? (
                  <div className={styles.runComparison}>
                    {[previousRun, activeRun].map((run, index) => (
                      <article key={run.runId} className={run.status === 'failed' ? styles.runFailed : styles.runSuccess}>
                        <div><span>RUN {activeRunIndex + index}</span><strong>{statusLabel(run.status)}</strong></div>
                        <code>{run.config.serializer === 'string' ? 'StringSerializer' : 'JsonSerializer'}</code>
                        <small>{run.status === 'failed' ? 'Serializer 검사소에서 중단' : 'offset 42 기록 + ACK 문자'}</small>
                      </article>
                    ))}
                    <div className={styles.diffSummary}><span>바뀐 설정</span><strong>value.serializer</strong><p>Broker 장애가 아니라 실제 value 타입과 Serializer의 불일치가 원인이었습니다.</p></div>
                  </div>
                ) : activeRun?.status !== 'succeeded' ? (
                  <p className={styles.emptyState}>실패를 수정하고 같은 메시지를 다시 보내면 실행 차이를 비교합니다.</p>
                ) : null}
                <div className={styles.references}>
                  <span>Kafka {KAFKA_RULE_VERSION} 근거</span>
                  {chapterOneReferences.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>)}
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className={styles.playbackBar} aria-label="실행 타임라인">
        <div className={styles.playbackButtons}>
          <button type="button" onClick={rewind} disabled={!activeRun} aria-label="처음으로 되감기"><Icon name="rewind" /></button>
          <button type="button" disabled={!activeRun} onClick={() => state.setIsPlaying(!state.isPlaying)} aria-label={state.isPlaying ? '일시정지' : '재생'}><Icon name={state.isPlaying ? 'pause' : 'play'} /></button>
          <button type="button" onClick={step} disabled={!activeRun} aria-label="한 단계 진행"><Icon name="step" /></button>
        </div>
        <div className={styles.speedControl} aria-label="재생 속도">
          {([0.5, 1, 2] as PlaybackSpeed[]).map((value) => <button type="button" key={value} className={speed === value ? styles.speedActive : ''} onClick={() => setSpeed(value)}>{value}×</button>)}
        </div>
        <div className={styles.timeline} data-timeline-events="true">
          {(activeRun?.events ?? []).map((event) => (
            <button type="button" key={event.id} className={`${styles.eventNode} ${event.sequence <= state.eventCursor ? styles.eventSeen : ''} ${event.sequence === state.eventCursor ? styles.eventActive : ''} ${event.state === 'failed' ? styles.eventFailed : ''}`} onClick={() => { clearPlaybackSegment(); state.setIsPlaying(false); state.setEventCursor(event.sequence) }} aria-label={`${event.sequence + 1}. ${event.title}`}>
              <span>{event.sequence + 1}</span><small>{EVENT_LABELS[event.kind]}</small>
            </button>
          ))}
          {!activeRun && <p>첫 실행 후 메시지의 모든 처리 순간이 여기에 나타납니다.</p>}
        </div>
        <div className={styles.clock}><span>LOGICAL TIME</span><strong>{activeEvent?.atMs ?? 0} ms</strong></div>
      </section>

      <footer className={styles.footer}>
        <span>Event City Lab v{APP_VERSION}</span><span>Content {CONTENT_VERSION}</span><span>Kafka rules {KAFKA_RULE_VERSION}</span><span>학습용 시뮬레이터 · Apache Kafka 및 ASF와 공식 제휴되지 않음</span>
      </footer>
    </main>
  )
}
