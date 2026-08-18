import { describe, expect, it } from 'vitest'

import { chapterHash, parseChapterRoute } from './chapterRoute'

describe('chapter hash route', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8] as const)('parses Chapter %s', (chapterId) => {
    expect(parseChapterRoute(chapterHash(chapterId))).toEqual({
      chapterId,
      canonicalHash: `#/chapter/${chapterId}`,
      isFallback: false,
    })
  })

  it('accepts a trailing slash without changing the selected chapter', () => {
    expect(parseChapterRoute('#/chapter/4/')).toMatchObject({ chapterId: 4, isFallback: false })
  })

  it.each(['', '#/', '#/chapter/0', '#/chapter/9', '#/chapter/two', '#/other/2'])(
    'falls back invalid route %s to the existing Chapter 1 URL',
    (hash) => {
      expect(parseChapterRoute(hash)).toEqual({
        chapterId: 1,
        canonicalHash: '#/chapter/1',
        isFallback: true,
      })
    },
  )
})
