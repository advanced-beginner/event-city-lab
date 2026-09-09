import { describe, expect, it } from 'vitest'

import { getAdvancedCityCamera } from './camera'
import { getAdvancedChapterScene } from './chapterScenes'

describe('advanced city camera', () => {
  it('keeps overview tied to the full atlas source coordinates', () => {
    const scene = getAdvancedChapterScene(2)
    const camera = getAdvancedCityCamera(scene, scene.physicalFacilities, 'overview', { width: 1440, height: 900 })

    expect(camera.sourceSize).toEqual({ width: 1920, height: 1047 })
    expect(camera.viewBox).toBe('0 0 1920 1047')
    expect(camera.preserveAspectRatio).toBe('xMidYMid meet')
  })

  it('frames the shared road and visible physical facilities for the panel ratio', () => {
    const scene = getAdvancedChapterScene(2)
    const usedFacilities = scene.physicalFacilities.filter((facility) => (
      scene.nodes.some((node) => node.roadAccessIndex === facility.roadAccessIndex)
    ))
    const camera = getAdvancedCityCamera(scene, usedFacilities, 'focus', { width: 1280, height: 720 })

    expect(camera.viewBoxRect.width).toBeLessThan(scene.viewport.width)
    expect(camera.viewBoxRect.height).toBeLessThan(scene.viewport.height)
    expect(camera.viewBoxRect.width / camera.viewBoxRect.height).toBeCloseTo(16 / 9, 2)

    for (const point of scene.mainRoad.points) {
      expect(point.x).toBeGreaterThanOrEqual(camera.viewBoxRect.x)
      expect(point.x).toBeLessThanOrEqual(camera.viewBoxRect.x + camera.viewBoxRect.width)
      expect(point.y).toBeGreaterThanOrEqual(camera.viewBoxRect.y)
      expect(point.y).toBeLessThanOrEqual(camera.viewBoxRect.y + camera.viewBoxRect.height)
    }
  })

  it('keeps the parked vehicle cargo label inside the initial 1280 focus camera', () => {
    const scene = getAdvancedChapterScene(2)
    const camera = getAdvancedCityCamera(scene, scene.physicalFacilities, 'focus', { width: 1280, height: 720 })
    const origin = scene.mainRoad.points[0]!
    const labelBottom = origin.y + 64

    expect(labelBottom).toBeLessThanOrEqual(camera.viewBoxRect.y + camera.viewBoxRect.height)
  })
})
