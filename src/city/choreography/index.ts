import type { ChapterCityCue } from '../types'
import { buildChapter23CityCue } from './chapter2_3'
import { buildChapter45CityCue } from './chapter4_5'
import { buildChapter68CityCue } from './chapter6_8'
import type { CityCueContext } from './types'

export function createChapterCityCue(context: CityCueContext): ChapterCityCue {
  switch (context.chapterId) {
    case 2:
    case 3:
      return buildChapter23CityCue(context)
    case 4:
    case 5:
      return buildChapter45CityCue(context)
    case 6:
    case 7:
    case 8:
      return buildChapter68CityCue(context)
  }
}
