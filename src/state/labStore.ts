import { createStore } from 'zustand/vanilla'

import { configToJava, javaToConfig } from '../domain/codeConfig'
import {
  DEFAULT_CONFIG,
  DEFAULT_LEARNING_PROGRESS,
  DEFAULT_MESSAGE,
  type LabMessage,
  type LearningProgress,
  type ProducerConfig,
  type SimulationRun,
  type WorkspaceSnapshot,
} from '../domain/simulation'

export type FocusedSetting = keyof ProducerConfig | null

export interface LabState {
  config: ProducerConfig
  message: LabMessage
  runs: SimulationRun[]
  activeRunId: string | null
  eventCursor: number
  isPlaying: boolean
  hintLevel: number
  focusedSetting: FocusedSetting
  javaCode: string
  codeWarnings: string[]
  hydrated: boolean
  engineError: string | null
  learningProgress: LearningProgress
  setSerializer: (serializer: ProducerConfig['serializer']) => void
  setFocusedSetting: (setting: FocusedSetting) => void
  updateCode: (code: string) => void
  addRun: (run: SimulationRun) => void
  setEventCursor: (cursor: number) => void
  setIsPlaying: (isPlaying: boolean) => void
  revealHint: () => void
  setEngineError: (message: string | null) => void
  recordExperimentAttempt: (chapterId: number, experimentId: string, succeeded: boolean) => void
  hydrate: (snapshot: WorkspaceSnapshot | null) => void
  replaceWorkspace: (snapshot: WorkspaceSnapshot) => void
}

export const labStore = createStore<LabState>((set) => ({
  config: DEFAULT_CONFIG,
  message: DEFAULT_MESSAGE,
  runs: [],
  activeRunId: null,
  eventCursor: -1,
  isPlaying: false,
  hintLevel: 0,
  focusedSetting: null,
  javaCode: configToJava(DEFAULT_CONFIG),
  codeWarnings: [],
  hydrated: false,
  engineError: null,
  learningProgress: DEFAULT_LEARNING_PROGRESS,
  setSerializer: (serializer) =>
    set((state) => {
      const config = { ...state.config, serializer }
      return { config, javaCode: configToJava(config), codeWarnings: [] }
    }),
  setFocusedSetting: (focusedSetting) => set({ focusedSetting }),
  updateCode: (javaCode) =>
    set((state) => {
      const parsed = javaToConfig(javaCode, state.config)
      return { javaCode, config: parsed.config, codeWarnings: parsed.warnings }
    }),
  addRun: (run) =>
    set((state) => ({
      runs: [...state.runs, run].slice(-20),
      activeRunId: run.runId,
      eventCursor: -1,
      isPlaying: true,
      engineError: null,
    })),
  setEventCursor: (eventCursor) => set({ eventCursor }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  revealHint: () => set((state) => ({ hintLevel: Math.min(4, state.hintLevel + 1) })),
  setEngineError: (engineError) => set({ engineError }),
  recordExperimentAttempt: (chapterId, experimentId, succeeded) =>
    set((state) => {
      const chapterKey = String(chapterId)
      const attemptKey = `${chapterKey}:${experimentId}`
      const previousCompleted = state.learningProgress.completedExperiments[chapterKey] ?? []
      const completedExperiments = succeeded && !previousCompleted.includes(experimentId)
        ? {
            ...state.learningProgress.completedExperiments,
            [chapterKey]: [...previousCompleted, experimentId],
          }
        : state.learningProgress.completedExperiments

      return {
        learningProgress: {
          completedExperiments,
          attempts: {
            ...state.learningProgress.attempts,
            [attemptKey]: (state.learningProgress.attempts[attemptKey] ?? 0) + 1,
          },
        },
      }
    }),
  hydrate: (snapshot) =>
    set(() => {
      if (!snapshot) return { hydrated: true }
      const activeRun = snapshot.runs.at(-1) ?? null
      return {
        config: snapshot.config,
        message: snapshot.message,
        runs: snapshot.runs,
        activeRunId: activeRun?.runId ?? null,
        eventCursor: activeRun ? activeRun.events.length - 1 : -1,
        hintLevel: snapshot.hintLevel,
        javaCode: configToJava(snapshot.config),
        learningProgress: snapshot.learningProgress,
        hydrated: true,
      }
    }),
  replaceWorkspace: (snapshot) =>
    set({
      config: snapshot.config,
      message: snapshot.message,
      runs: snapshot.runs,
      activeRunId: snapshot.runs.at(-1)?.runId ?? null,
      eventCursor: (snapshot.runs.at(-1)?.events.length ?? 0) - 1,
      hintLevel: snapshot.hintLevel,
      javaCode: configToJava(snapshot.config),
      codeWarnings: [],
      hydrated: true,
      engineError: null,
      learningProgress: snapshot.learningProgress,
    }),
}))
