import { useEffect, useState } from 'react'

import { isChapterId, type ChapterId } from '../chapters/registry'

export const DEFAULT_CHAPTER_ID: ChapterId = 1

export interface ChapterRoute {
  chapterId: ChapterId
  canonicalHash: string
  isFallback: boolean
}

export function chapterHash(chapterId: ChapterId): string {
  return `#/chapter/${chapterId}`
}

export function parseChapterRoute(hash: string): ChapterRoute {
  const match = /^#\/chapter\/(\d+)\/?$/.exec(hash)
  const parsedId = match?.[1] ? Number(match[1]) : Number.NaN
  const chapterId = isChapterId(parsedId) ? parsedId : DEFAULT_CHAPTER_ID

  return {
    chapterId,
    canonicalHash: chapterHash(chapterId),
    isFallback: !isChapterId(parsedId),
  }
}

export function useChapterRoute(): ChapterRoute {
  const [route, setRoute] = useState(() => parseChapterRoute(window.location.hash))

  useEffect(() => {
    const syncFromLocation = () => {
      const nextRoute = parseChapterRoute(window.location.hash)
      if (nextRoute.isFallback && window.location.hash !== nextRoute.canonicalHash) {
        window.history.replaceState(null, '', nextRoute.canonicalHash)
      }
      setRoute(nextRoute)
    }

    syncFromLocation()
    window.addEventListener('hashchange', syncFromLocation)
    return () => window.removeEventListener('hashchange', syncFromLocation)
  }, [])

  return route
}
