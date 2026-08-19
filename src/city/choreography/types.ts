import type {
  ChapterEventTemplate,
  ChapterRunStatus,
} from '../../domain/chapterSimulation'
import type { ChapterCityCue } from '../types'

export interface CityCueContext {
  chapterId: 2 | 3 | 4 | 5 | 6 | 7 | 8
  experimentId: string
  choiceId: string
  outcomeStatus: ChapterRunStatus
  event: ChapterEventTemplate
  sequence: number
  eventCount: number
}

export type ChapterCityCueBuilder = (context: CityCueContext) => ChapterCityCue
