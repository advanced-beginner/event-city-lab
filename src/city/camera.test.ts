import { describe, expect, it } from 'vitest'

import { getAdvancedCityCamera } from './camera'
import { getAdvancedChapterScene, getChapterOneScene } from './chapterScenes'

describe('isometric diorama camera', () => {
  it('keeps overview tied to the 1600x900 diorama viewport coordinates', () => {
    const scene = getAdvancedChapterScene(2)
    const camera = getAdvancedCityCamera(scene, scene.physicalFacilities, 'overview', { width: 1440, height: 900 })

    expect(camera.sourceSize).toEqual({ width: 1600, height: 900 })
    expect(camera.viewBox).toBe('0 0 1600 900')
    expect(camera.preserveAspectRatio).toBe('xMidYMid meet')
  })

  it('frames all routes and facilities cleanly in focus mode for Chapter 1 and Chapters 2-8', () => {
    for (const scene of [getChapterOneScene(), getAdvancedChapterScene(2), getAdvancedChapterScene(7)]) {
      const camera = getAdvancedCityCamera(scene, scene.physicalFacilities, 'focus', { width: 1280, height: 720 })

      expect(camera.viewBoxRect.width).toBeLessThanOrEqual(scene.viewport.width)
      expect(camera.viewBoxRect.height).toBeLessThanOrEqual(scene.viewport.height)
      expect(camera.viewBoxRect.width / camera.viewBoxRect.height).toBeCloseTo(16 / 9, 2)

      for (const route of scene.routes) {
        for (const point of route.points) {
          expect(point.x).toBeGreaterThanOrEqual(camera.viewBoxRect.x)
          expect(point.x).toBeLessThanOrEqual(camera.viewBoxRect.x + camera.viewBoxRect.width)
          expect(point.y).toBeGreaterThanOrEqual(camera.viewBoxRect.y)
          expect(point.y).toBeLessThanOrEqual(camera.viewBoxRect.y + camera.viewBoxRect.height)
        }
      }
    }
  })

  it('keeps the parked vehicle cargo label inside the 1280 focus camera', () => {
    const scene = getAdvancedChapterScene(2)
    const camera = getAdvancedCityCamera(scene, scene.physicalFacilities, 'focus', { width: 1280, height: 720 })
    const initialRoute = scene.routes.find((route) => route.id === scene.initialVehicleRouteId)!
    const origin = initialRoute.points[0]!

    expect(origin.y + 42).toBeLessThanOrEqual(camera.viewBoxRect.y + camera.viewBoxRect.height)
  })
})
