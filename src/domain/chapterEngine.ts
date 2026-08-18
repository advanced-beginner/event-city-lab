import type {
  AdvancedChapterId,
  ChapterSimulationInput,
  ChapterSimulationRun,
  ChapterRuleModule,
} from './chapterSimulation'
import { runChapterRule, validateChapterRule } from './chapterSimulation'
import { chapter2Rule } from './chapters/chapter2'
import { chapter3Rule } from './chapters/chapter3'
import { chapter4Rule } from './chapters/chapter4'
import { chapter5Rule } from './chapters/chapter5'
import { chapter6Rule } from './chapters/chapter6'
import { chapter7Rule } from './chapters/chapter7'
import { chapter8Rule } from './chapters/chapter8'

const CHAPTER_RULES = {
  2: chapter2Rule,
  3: chapter3Rule,
  4: chapter4Rule,
  5: chapter5Rule,
  6: chapter6Rule,
  7: chapter7Rule,
  8: chapter8Rule,
} as const satisfies Record<AdvancedChapterId, ChapterRuleModule>

for (const rule of Object.values(CHAPTER_RULES)) validateChapterRule(rule)

export function getChapterRule(chapterId: AdvancedChapterId): ChapterRuleModule {
  const rule = CHAPTER_RULES[chapterId]
  if (!rule) {
    throw new Error(`Missing chapter rule for chapter ${chapterId}.`)
  }
  return rule
}

export function simulateChapterExperiment(input: ChapterSimulationInput): ChapterSimulationRun {
  return runChapterRule(getChapterRule(input.chapterId), input)
}
