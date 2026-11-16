import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'

import { ChapterNavigation } from '../chapters/ChapterNavigation'
import type { ChapterMetadata } from '../chapters/registry'
import type { AdvancedCityViewMode } from '../city/camera'
import { getAdvancedChapterScene, getExperimentCityPreview } from '../city/chapterScenes'
import type { CitySize } from '../city/types'
import { kafkaReferences } from '../content/kafkaReferences'
import { getChapterRule } from '../domain/chapterEngine'
import type {
  AdvancedChapterId,
  ChapterSimulationRun,
} from '../domain/chapterSimulation'
import {
  APP_VERSION,
  CONTENT_VERSION,
  KAFKA_RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type WorkspaceSnapshot,
} from '../domain/simulation'
import { labStore } from '../state/labStore'
import { loadWorkspace, parseWorkspaceJson, saveWorkspace, serializeWorkspace } from '../storage/workspaceDb'
import styles from '../styles/LabWorkspace.module.css'
import { runChapterSimulation } from '../worker/client'
import {
  carrierProgressAtCursor,
  createPlaybackSegment,
  createPlaybackSnapshots,
  inspectFacilityAtCursor,
  interpolatePlaybackProgress,
  retimePlaybackSegment,
  type PlaybackSpeed,
} from './guidedPlayback'
import { IsometricDioramaStage } from './IsometricDioramaStage'

type Prediction = 'failed' | 'succeeded'
type EvidenceTab = 'logs' | 'analysis' | 'comparison'

function makeSnapshot(): WorkspaceSnapshot {
  const state = labStore.getState()
  return {
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
  }
}

function firstFailureChoiceId(
  choices: readonly { id: string }[],
  recommendedChoiceId: string,
): string {
  return choices.find((choice) => choice.id !== recommendedChoiceId)?.id
    ?? choices[0]?.id
    ?? ''
}

function readReducedMotionSetting(): boolean {
  try {
    return window.localStorage.getItem('ecl:reduced-motion') === 'true'
  } catch {
    return false
  }
}

function readOsReducedMotionPreference(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function GuidedChapterLab({ chapter }: { chapter: ChapterMetadata }) {
  if (chapter.id === 1) throw new Error('Chapter 1 uses the dedicated Producer lab.')

  const chapterId = chapter.id as AdvancedChapterId
  const rule = getChapterRule(chapterId)
  const workspaceState = useStore(labStore)
  const [experimentIndex, setExperimentIndex] = useState(0)
  const experiment = rule.experiments[experimentIndex] ?? rule.experiments[0]
  if (!experiment) throw new Error(`Chapter ${chapterId} has no experiments.`)

  const [choiceId, setChoiceId] = useState(() =>
    firstFailureChoiceId(experiment.choices, experiment.recommendedChoiceId),
  )
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [run, setRun] = useState<ChapterSimulationRun | null>(null)
  const [previousRun, setPreviousRun] = useState<ChapterSimulationRun | null>(null)
  const [eventCursor, setEventCursor] = useState(-1)
  const eventCursorRef = useRef(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)
  const [playbackPulse, setPlaybackPulse] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [evidenceTab, setEvidenceTab] = useState<EvidenceTab>('logs')
  const [inspectedFacilityId, setInspectedFacilityId] = useState<string | null>(null)
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null)
  const [showInspectedRole, setShowInspectedRole] = useState(false)
  const [saveStatus, setSaveStatus] = useState('진도 불러오는 중')
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [carrierProgress, setCarrierProgress] = useState(0)
  const carrierProgressRef = useRef(0)
  const runRequestSerial = useRef(0)
  const autoSwitchedRunId = useRef<string | null>(null)
  const playbackFrameRef = useRef<number | null>(null)
  const activeSegmentRef = useRef<ReturnType<typeof createPlaybackSegment>>(null)
  const activeSegmentSettingsKeyRef = useRef('')
  const segmentStartedAtRef = useRef(0)
  const segmentLastTimestampRef = useRef(0)
  const segmentElapsedRef = useRef(0)
  const [viewMode, setViewMode] = useState<AdvancedCityViewMode>('focus')
  const [exploded, setExploded] = useState(false)
  const [viewportSize, setViewportSize] = useState<CitySize>({ width: 1280, height: 720 })
  const cityViewportRef = useRef<HTMLDivElement | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [appReducedMotion, setAppReducedMotion] = useState(readReducedMotionSetting)
  const [osReducedMotion, setOsReducedMotion] = useState(readOsReducedMotionPreference)
  const reducedMotion = appReducedMotion || osReducedMotion

  const completedIds = workspaceState.learningProgress.completedExperiments[String(chapterId)] ?? []
  const completedCount = rule.experiments.filter((candidate) => completedIds.includes(candidate.id)).length
  const chapterComplete = completedCount === rule.experiments.length
  const attemptKey = `${chapterId}:${experiment.id}`
  const attempts = workspaceState.learningProgress.attempts[attemptKey] ?? 0
  const terminalEventSelected = Boolean(run && eventCursor >= run.events.length - 1)
  const terminalSettled = Boolean(terminalEventSelected && !activeSegmentRef.current && !isPlaying)
  const visibleEvents = run ? run.events.slice(0, eventCursor + 1) : []
  const activeEvent = run?.events[eventCursor] ?? null
  const references = kafkaReferences.filter((reference) => experiment.referenceIds.includes(reference.id))
  const scene = getAdvancedChapterScene(chapterId)
  const scenePreview = getExperimentCityPreview(experiment.id, choiceId)
  const selectedChoice = experiment.choices.find((choice) => choice.id === choiceId)
  const playbackSnapshots = useMemo(
    () => (run ? createPlaybackSnapshots(scene, run.events) : createPlaybackSnapshots(scene, [])),
    [run, scene],
  )
  const projectedWorld = playbackSnapshots.find((snapshot) => snapshot.cursor === eventCursor)?.world
  const inspectedNode = scene.nodes.find((node) => node.id === inspectedNodeId) ?? null
  const inspectedFacilityNodes = useMemo(() => {
    if (!inspectedFacilityId) return []
    return scene.nodes.filter((node) => node.facilityId === inspectedFacilityId)
  }, [inspectedFacilityId, scene])
  const pendingRerun = Boolean(run && choiceId !== run.choiceId)

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

  const seekToCursor = (cursor: number) => {
    clearPlaybackSegment()
    setIsPlaying(false)
    eventCursorRef.current = cursor
    setEventCursor(cursor)
    setCarrierProgressValue(carrierProgressAtCursor(scene, run?.events ?? [], cursor, playbackSnapshots))
    if (cursor < 0) setEvidenceTab('logs')
  }

  useEffect(() => {
    runRequestSerial.current += 1
    const firstExperiment = rule.experiments[0]
    if (!firstExperiment) return
    setExperimentIndex(0)
    setChoiceId(firstFailureChoiceId(firstExperiment.choices, firstExperiment.recommendedChoiceId))
    setPrediction(null)
    setRun(null)
    setPreviousRun(null)
    setEvidenceTab('logs')
    autoSwitchedRunId.current = null
    clearPlaybackSegment()
    eventCursorRef.current = -1
    setEventCursor(-1)
    setCarrierProgressValue(0)
    setIsPlaying(false)
    setIsRunning(false)
    setEngineError(null)
    setInspectedFacilityId(null)
    setInspectedNodeId(null)
    setShowInspectedRole(false)
  }, [chapterId, rule])

  useEffect(() => () => {
    runRequestSerial.current += 1
  }, [])

  useEffect(() => {
    if (workspaceState.hydrated) {
      setSaveStatus('이 기기에 저장됨')
      return
    }

    let cancelled = false
    void loadWorkspace()
      .then((snapshot) => {
        if (cancelled) return
        labStore.getState().hydrate(snapshot)
        setSaveStatus(snapshot ? '진도 복원됨' : '새 학습 진도')
      })
      .catch(() => {
        if (cancelled) return
        labStore.getState().hydrate(null)
        setSaveStatus('저장소 복구 필요')
      })
    return () => { cancelled = true }
  }, [workspaceState.hydrated])

  useEffect(() => {
    if (!run || !terminalSettled || autoSwitchedRunId.current === run.runId) return
    autoSwitchedRunId.current = run.runId
    setEvidenceTab(run.status === 'failed' ? 'analysis' : 'comparison')
  }, [run, terminalSettled])

  useEffect(() => {
    isPlayingRef.current = isPlaying
    if (!isPlaying || !run) return

    const settingsKey = `${speed}:${viewMode}:${viewportSize.width}:${viewportSize.height}:${reducedMotion}`
    let segment = activeSegmentRef.current
    if (!segment) {
      segment = createPlaybackSegment({
        currentProgress: carrierProgressRef.current,
        cursor: eventCursorRef.current,
        events: run.events,
        scene,
        speed,
        snapshots: playbackSnapshots,
        viewMode,
        viewportSize,
      })
      if (!segment) {
        isPlayingRef.current = false
        setIsPlaying(false)
        return
      }
      activeSegmentRef.current = segment
      activeSegmentSettingsKeyRef.current = settingsKey
      segmentElapsedRef.current = 0
      eventCursorRef.current = segment.toCursor
      setEventCursor(segment.toCursor)
    } else if (activeSegmentSettingsKeyRef.current !== settingsKey) {
      const retimedSegment = retimePlaybackSegment({
        currentProgress: carrierProgressRef.current,
        elapsedMs: segmentElapsedRef.current,
        events: run.events,
        previousSegment: segment,
        scene,
        speed,
        snapshots: playbackSnapshots,
        viewMode,
        viewportSize,
      })
      if (!retimedSegment) {
        isPlayingRef.current = false
        setIsPlaying(false)
        return
      }
      segment = retimedSegment
      activeSegmentRef.current = retimedSegment
      activeSegmentSettingsKeyRef.current = settingsKey
      segmentElapsedRef.current = 0
    }

    if (!segment) {
      isPlayingRef.current = false
      setIsPlaying(false)
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
        if (segment.toCursor >= run.events.length - 1) {
          isPlayingRef.current = false
          setIsPlaying(false)
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
  }, [isPlaying, playbackPulse, playbackSnapshots, reducedMotion, run, scene, speed, viewMode, viewportSize])

  useEffect(() => () => {
    if (playbackFrameRef.current !== null) window.cancelAnimationFrame(playbackFrameRef.current)
  }, [])

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

  useEffect(() => {
    try {
      window.localStorage.setItem('ecl:reduced-motion', String(appReducedMotion))
    } catch {
      // Best-effort storage persistence.
    }
  }, [appReducedMotion])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event: MediaQueryListEvent) => setOsReducedMotion(event.matches)
    media.addEventListener?.('change', handleChange)
    return () => media.removeEventListener?.('change', handleChange)
  }, [])

  const selectExperiment = (nextIndex: number) => {
    const next = rule.experiments[nextIndex]
    if (!next) return
    runRequestSerial.current += 1
    setExperimentIndex(nextIndex)
    setChoiceId(firstFailureChoiceId(next.choices, next.recommendedChoiceId))
    setPrediction(null)
    setRun(null)
    setPreviousRun(null)
    setEvidenceTab('logs')
    autoSwitchedRunId.current = null
    clearPlaybackSegment()
    eventCursorRef.current = -1
    setEventCursor(-1)
    setCarrierProgressValue(0)
    isPlayingRef.current = false
    setIsPlaying(false)
    setIsRunning(false)
    setEngineError(null)
    setInspectedFacilityId(null)
    setInspectedNodeId(null)
    setShowInspectedRole(false)
  }

  const execute = async () => {
    if (!choiceId || !prediction || isRunning) return
    const requestSerial = runRequestSerial.current + 1
    runRequestSerial.current = requestSerial
    setIsRunning(true)
    setEngineError(null)
    setEvidenceTab('logs')
    autoSwitchedRunId.current = null
    if (run) setPreviousRun(run)
    setRun(null)
    clearPlaybackSegment()
    eventCursorRef.current = -1
    setEventCursor(-1)
    setCarrierProgressValue(0)
    setInspectedFacilityId(null)
    setInspectedNodeId(null)
    setShowInspectedRole(false)
    try {
      const nextRun = await runChapterSimulation({
        runId: `chapter-${chapterId}-${experiment.id}-${crypto.randomUUID()}`,
        seed: chapterId * 1000 + experimentIndex * 100 + attempts + 1,
        chapterId,
        experimentId: experiment.id,
        choiceId,
      })
      if (runRequestSerial.current !== requestSerial) return
      setRun(nextRun)
      const nextSnapshots = createPlaybackSnapshots(scene, nextRun.events)
      setInspectedNodeId(null)
      setInspectedFacilityId(null)
      setShowInspectedRole(false)
      eventCursorRef.current = -1
      setEventCursor(-1)
      setCarrierProgressValue(carrierProgressAtCursor(scene, nextRun.events, -1, nextSnapshots))
      setIsPlaying(nextRun.events.length > 1)
      labStore.getState().recordExperimentAttempt(chapterId, experiment.id, nextRun.status === 'succeeded')
      setSaveStatus('저장 중…')
      await saveWorkspace(makeSnapshot())
      setSaveStatus('이 기기에 저장됨')
    } catch (error) {
      if (runRequestSerial.current !== requestSerial) return
      setEngineError(error instanceof Error ? error.message : '시뮬레이션을 실행하지 못했습니다.')
    } finally {
      if (runRequestSerial.current === requestSerial) setIsRunning(false)
    }
  }

  const inspectFacility = (facilityOrNodeId: string) => {
    isPlayingRef.current = false
    setIsPlaying(false)
    const inspection = inspectFacilityAtCursor({
      cursor: eventCursor,
      events: run?.events ?? [],
      facilityOrNodeId,
      scene,
    })
    setInspectedFacilityId(inspection.facilityId)
    setInspectedNodeId(inspection.latestNodeId ?? inspection.nodeIds[0] ?? facilityOrNodeId)
    if (!run || eventCursor < 0) {
      setShowInspectedRole(true)
      return
    }
    if (inspection.latestEventIndex < 0) {
      setShowInspectedRole(true)
      return
    }
    setShowInspectedRole(false)
    seekToCursor(inspection.latestEventIndex)
  }

  const selectInspectedNode = (nodeId: string) => {
    setInspectedNodeId(nodeId)
    isPlayingRef.current = false
    setIsPlaying(false)
    if (!run || eventCursor < 0) {
      setShowInspectedRole(true)
      return
    }
    const inspection = inspectFacilityAtCursor({
      cursor: eventCursor,
      events: run.events,
      facilityOrNodeId: nodeId,
      logicalNodeId: nodeId,
      scene,
    })
    if (inspection.latestEventIndex < 0) {
      setShowInspectedRole(true)
      return
    }
    setShowInspectedRole(false)
    seekToCursor(inspection.latestEventIndex)
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
      labStore.getState().replaceWorkspace(snapshot)
      setSaveStatus('가져오기 완료')
    } catch {
      setSaveStatus('가져오기 실패')
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
          <span className={styles.progressBadge}>{completedCount} / {rule.experiments.length} 완료</span>
          <span className={styles.saveState}><span aria-hidden="true">●</span> {saveStatus}</span>
          <button
            type="button"
            className={styles.motionButton}
            aria-pressed={appReducedMotion}
            onClick={() => setAppReducedMotion((value) => !value)}
            title={osReducedMotion ? '운영체제의 모션 줄임 설정이 적용 중입니다.' : undefined}
          >
            {osReducedMotion ? '모션 줄임 · OS' : appReducedMotion ? '모션 줄임 켬' : '모션 줄임'}
          </button>
          <button className={styles.textButton} type="button" onClick={handleExport}>내보내기</button>
          <button className={styles.textButton} type="button" onClick={() => importRef.current?.click()}>가져오기</button>
          <input ref={importRef} className={styles.hiddenInput} type="file" accept="application/json" onChange={(event) => void handleImport(event.target.files?.[0])} />
        </div>
      </header>

      <section className={styles.missionStrip}>
        <div className={styles.missionTitle}>
          <span className={styles.sectionIndex}>{String(experimentIndex + 1).padStart(2, '0')}</span>
          <strong>{experiment.title}</strong>
        </div>
        <p>{experiment.mission}</p>
        <output className={`${styles.scoreBadge} ${chapterComplete ? styles.scoreBadgeComplete : ''}`}>
          평가 {Math.round((completedCount / rule.experiments.length) * 100)}%
        </output>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.controlPanel} aria-label="실험 설정">
          <div className={styles.panelHeader}>
            <div><p className={styles.kicker}>LAB EXPERIMENTS</p><h2>세 가지 실험</h2></div>
            <span className={chapterComplete ? styles.readyBadge : styles.missionBadge}>{completedCount}/{rule.experiments.length}</span>
          </div>

          <div className={styles.scrollArea}>
            <div className={styles.experimentList}>
              {rule.experiments.map((candidate, index) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={index === experimentIndex ? styles.activeExperiment : undefined}
                  onClick={() => selectExperiment(index)}
                >
                  <span>{completedIds.includes(candidate.id) ? '✓' : index + 1}</span>
                  <strong>{candidate.title}</strong>
                </button>
              ))}
            </div>

            <div className={styles.prompt}>
              <span>먼저 예측하세요</span>
              <p>{experiment.predictionPrompt}</p>
              <div>
                <button type="button" aria-pressed={prediction === 'failed'} onClick={() => setPrediction('failed')}>실패한다</button>
                <button type="button" aria-pressed={prediction === 'succeeded'} onClick={() => setPrediction('succeeded')}>성공한다</button>
              </div>
            </div>

            <fieldset className={styles.choices}>
              <legend>실행 설정</legend>
              {experiment.choices.map((choice) => (
                <label key={choice.id}>
                  <input
                    type="radio"
                    name={`${chapterId}-${experiment.id}-choice`}
                    value={choice.id}
                    checked={choiceId === choice.id}
                    onChange={() => setChoiceId(choice.id)}
                  />
                  <span><strong>{choice.label}</strong><small>{choice.description}</small></span>
                </label>
              ))}
            </fieldset>
          </div>

          {pendingRerun && (
            <div className={styles.pendingBadge}>
              <span>↻</span>
              <div><strong>수정 대기</strong><small>같은 조건으로 다시 실행해 비교하세요.</small></div>
            </div>
          )}

          <button className={styles.primaryRunButton} type="button" disabled={!prediction || isRunning} onClick={execute}>
            {isRunning ? '도시 실행 중…' : attempts > 0 ? '같은 조건으로 재실행' : '예측한 조건 실행'}
          </button>
          {engineError && <p className={styles.fieldError} role="alert">{engineError}</p>}
        </aside>

        <section className={styles.worldPanel} aria-label="Kafka 도시 시뮬레이션" ref={cityViewportRef}>
          <IsometricDioramaStage
            scene={scene}
            events={run?.events ?? []}
            cursor={eventCursor}
            carrierProgress={carrierProgress}
            isPlaying={isPlaying}
            {...(run && terminalSettled ? { runStatus: run.status } : {})}
            viewportSize={viewportSize}
            viewMode={viewMode}
            exploded={exploded}
            reducedMotion={reducedMotion}
            pendingRerun={pendingRerun}
            preview={scenePreview}
            onViewModeChange={setViewMode}
            onToggleExploded={() => setExploded((value) => !value)}
            onInspect={inspectFacility}
          />
          <div className={`${styles.worldStatus} ${activeEvent?.state === 'failed' ? styles.worldStatusFailed : ''}`}>
            <span>{activeEvent ? eventCursor + 1 : '·'}</span>
            <div>
              <strong>{pendingRerun ? '설정은 바뀌었지만 이 실행은 그대로입니다.' : showInspectedRole ? inspectedNode?.ariaLabel ?? inspectedNode?.label : activeEvent?.title ?? inspectedNode?.ariaLabel ?? inspectedNode?.label ?? '설정과 결과를 예측한 뒤 도시를 실행하세요.'}</strong>
              <small>{pendingRerun ? '권장 설정을 적용하려면 같은 조건으로 도시를 다시 실행하세요.' : showInspectedRole ? inspectedNode?.description : activeEvent?.detail ?? inspectedNode?.description ?? selectedChoice?.description ?? experiment.successCriteria}</small>
            </div>
          </div>
        </section>

        <aside className={styles.evidencePanel} aria-label="실행 증거">
          <div className={styles.currentEvent}>
            <div>
              <p className={styles.kicker}>CURRENT EVENT</p>
              <span>{run ? (terminalSettled ? (run.status === 'failed' ? '실패 관찰' : '조건 충족') : `${eventCursor + 1} / ${run.events.length}`) : '실행 전'}</span>
            </div>
            <h2>{activeEvent?.title ?? '실행 전'}</h2>
            <p>{activeEvent?.detail ?? '설정과 결과를 예측하고 실행하면 단계별 증거가 여기에 기록됩니다.'}</p>
            <time>{activeEvent?.atMs ?? 0} ms</time>
          </div>

          {inspectedNode && (
            <div className={styles.inspector}>
              <span>시설 조사</span>
              <strong>{inspectedNode.ariaLabel ?? inspectedNode.label}</strong>
              <p>{showInspectedRole ? inspectedNode.description : activeEvent?.detail ?? inspectedNode.description}</p>
              {inspectedFacilityNodes.length > 1 && (
                <div className={styles.logicalNodePicker} role="group" aria-label="건물 내부 논리 노드">
                  {inspectedFacilityNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      aria-pressed={node.id === inspectedNodeId}
                      onClick={() => selectInspectedNode(node.id)}
                    >
                      {projectedWorld?.nodes[node.id]?.label ?? node.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.tabs} role="tablist" aria-label="로그, 분석, 비교">
            <button role="tab" aria-selected={evidenceTab === 'logs'} className={evidenceTab === 'logs' ? styles.tabActive : ''} onClick={() => setEvidenceTab('logs')}>로그</button>
            <button role="tab" aria-selected={evidenceTab === 'analysis'} className={evidenceTab === 'analysis' ? styles.tabActive : ''} onClick={() => setEvidenceTab('analysis')}>분석</button>
            <button role="tab" aria-selected={evidenceTab === 'comparison'} className={evidenceTab === 'comparison' ? styles.tabActive : ''} onClick={() => setEvidenceTab('comparison')}>비교</button>
          </div>

          <div className={styles.evidenceBody}>
            {evidenceTab === 'logs' && (
              <>
                <ol className={styles.logList}>
                  {visibleEvents.length === 0
                    ? <li className={styles.emptyState}>아직 이벤트가 없습니다.</li>
                    : visibleEvents.map((event) => (
                        <li key={event.id} className={event.state === 'failed' ? styles.logError : undefined}>
                          <time>{event.atMs}ms</time><code>{event.log}</code>
                        </li>
                      ))}
                </ol>
                <div className={styles.references}>
                  <span>Kafka {KAFKA_RULE_VERSION} 근거</span>
                  {references.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>)}
                </div>
              </>
            )}

            {evidenceTab === 'analysis' && (
              <div>
                {terminalSettled && run?.status === 'failed' && run.diagnosis ? (
                  <div className={styles.diagnosisCard}>
                    <strong>{run.diagnosis.symptom}</strong>
                    <p>{run.diagnosis.rootCause}</p>
                    <ul>{run.diagnosis.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
                    <button type="button" onClick={() => setChoiceId(run.diagnosis?.recommendedChoiceId ?? choiceId)}>
                      권장 설정 적용
                    </button>
                    <small>{run.diagnosis.tradeOff}</small>
                  </div>
                ) : run?.status === 'succeeded' && terminalSettled ? (
                  <div className={styles.successCard}>
                    <strong>실험 통과</strong>
                    <p>{run.summary}</p>
                    {experimentIndex < rule.experiments.length - 1 && (
                      <button type="button" onClick={() => selectExperiment(experimentIndex + 1)}>다음 실험</button>
                    )}
                  </div>
                ) : (
                  <p className={styles.emptyState}>실행이 완료되면 원인 분석과 권장 설정이 여기에 표시됩니다.</p>
                )}
                <div className={styles.references}>
                  <span>Kafka {KAFKA_RULE_VERSION} 근거</span>
                  {references.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>)}
                </div>
              </div>
            )}

            {evidenceTab === 'comparison' && (
              <div>
                {terminalSettled && run?.status === 'succeeded' && (
                  <div className={styles.successCard}>
                    <strong>실험 통과</strong>
                    <p>{run.summary}</p>
                    {experimentIndex < rule.experiments.length - 1 && (
                      <button type="button" onClick={() => selectExperiment(experimentIndex + 1)}>다음 실험</button>
                    )}
                  </div>
                )}

                {previousRun && run ? (
                  <div className={styles.runComparison}>
                    {[previousRun, run].map((item, idx) => (
                      <article key={item.runId} className={item.status === 'failed' ? styles.runFailed : styles.runSuccess}>
                        <div><span>RUN {idx + 1}</span><strong>{item.status === 'failed' ? '실패' : '성공'}</strong></div>
                        <code>{experiment.choices.find((c) => c.id === item.choiceId)?.label ?? item.choiceId}</code>
                        <small>{item.summary}</small>
                      </article>
                    ))}
                    {previousRun.diagnosis && (
                      <div className={styles.diffSummary}>
                        <span>TRADE-OFF</span>
                        <strong>{experiment.title}</strong>
                        <p>{previousRun.diagnosis.tradeOff}</p>
                      </div>
                    )}
                  </div>
                ) : !terminalSettled || run?.status !== 'succeeded' ? (
                  <p className={styles.emptyState}>실패와 성공 실행을 모두 진행하면 두 결과를 나란히 비교합니다.</p>
                ) : null}

                <div className={styles.references}>
                  <span>Kafka {KAFKA_RULE_VERSION} 근거</span>
                  {references.map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a>)}
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className={styles.playbackBar} aria-label="이벤트 타임라인">
        <div className={styles.playbackButtons}>
          <button type="button" disabled={!run} onClick={() => seekToCursor(-1)}>처음</button>
          <button
            type="button"
            disabled={!run}
            onClick={() => setIsPlaying((value) => {
              isPlayingRef.current = !value
              return !value
            })}
          >{isPlaying ? '일시정지' : '재생'}</button>
          <button type="button" disabled={!run || eventCursor >= (run.events.length - 1)} onClick={() => seekToCursor(eventCursor + 1)}>한 단계</button>
        </div>
        <label className={styles.speedControl}>
          <span>속도</span>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value) as PlaybackSpeed)}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
        <div className={styles.timeline} data-timeline-events="true">
          {run?.events.map((event, index) => (
            <button
              key={event.id}
              type="button"
              className={`${styles.eventNode} ${index < eventCursor ? styles.eventSeen : ''} ${index === eventCursor ? styles.eventActive : ''} ${event.state === 'failed' ? styles.eventFailed : ''}`}
              onClick={() => seekToCursor(index)}
              title={event.title}
            ><span>{index + 1}</span><small>{event.title}</small></button>
          )) ?? <p>실행 후 사건 순서를 되감아 조사할 수 있습니다.</p>}
        </div>
        <div className={styles.clock}>
          <span>LOGICAL TIME</span>
          <output>{activeEvent?.atMs ?? 0}ms</output>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Event City Lab v{APP_VERSION}</span><span>Content {CONTENT_VERSION}</span>
        <span>{chapterComplete ? 'Sandbox 재실행 가능 · 평가 100%' : '모든 실험을 통과하면 Sandbox가 열립니다.'}</span>
      </footer>
    </main>
  )
}
