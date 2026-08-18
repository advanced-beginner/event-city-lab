import { describe, expect, it } from 'vitest'

import { CHAPTERS, CHAPTER_IDS, getChapter, isChapterId } from './registry'

describe('chapter registry', () => {
  it('defines one ordered metadata entry for every Chapter 1–8 route', () => {
    expect(CHAPTERS.map((chapter) => chapter.id)).toEqual(CHAPTER_IDS)
    expect(new Set(CHAPTERS.map((chapter) => chapter.numberLabel)).size).toBe(8)
    expect(CHAPTERS.every((chapter) => chapter.title && chapter.topic && chapter.learningGoal)).toBe(true)
  })

  it('distinguishes implemented content from navigable planned chapters', () => {
    expect(getChapter(1).implementationStatus).toBe('implemented')
    expect(CHAPTERS.slice(1).every((chapter) => chapter.implementationStatus === 'planned')).toBe(true)
  })

  it('accepts only registered numeric chapter identifiers', () => {
    expect(isChapterId(1)).toBe(true)
    expect(isChapterId(8)).toBe(true)
    expect(isChapterId(0)).toBe(false)
    expect(isChapterId(9)).toBe(false)
    expect(isChapterId(Number.NaN)).toBe(false)
  })
})
