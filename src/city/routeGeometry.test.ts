import { describe, expect, it } from 'vitest'

import {
  interpolatePolyline,
  isPointOnPolyline,
  nearestPointOnPolyline,
  polylineLength,
} from './routeGeometry'
import type { CityPoint } from './types'

describe('routeGeometry', () => {
  it('interpolates around bends by cumulative distance instead of endpoint chord', () => {
    const route = points([0, 0], [10, 0], [10, 30])

    expect(polylineLength(route)).toBe(40)
    expect(interpolatePolyline(route, 0.5)).toEqual({ x: 10, y: 10 })
  })

  it('clamps progress to the route endpoints', () => {
    const route = points([3, 4], [13, 4])

    expect(interpolatePolyline(route, -1)).toEqual({ x: 3, y: 4 })
    expect(interpolatePolyline(route, 2)).toEqual({ x: 13, y: 4 })
  })

  it('handles degenerate and repeated points without producing NaN', () => {
    const route = points([5, 6], [5, 6], [5, 6])

    expect(polylineLength(route)).toBe(0)
    expect(interpolatePolyline(route, 0.75)).toEqual({ x: 5, y: 6 })
    expect(nearestPointOnPolyline(route, { x: 8, y: 10 })).toMatchObject({
      point: { x: 5, y: 6 },
      routeProgress: 0,
    })
  })

  it('projects points onto the nearest segment with segment and route progress', () => {
    const route = points([0, 0], [10, 0], [10, 10])
    const projection = nearestPointOnPolyline(route, { x: 7, y: 3 })

    expect(projection.segmentIndex).toBe(0)
    expect(projection.segmentProgress).toBeCloseTo(0.7)
    expect(projection.routeProgress).toBeCloseTo(0.35)
    expect(projection.distance).toBeCloseTo(3)
    expect(isPointOnPolyline(route, { x: 10, y: 6 })).toBe(true)
  })

  it('keeps equivalent distance behavior for forward and reversed point arrays', () => {
    const forward = points([0, 0], [10, 0], [10, 30])
    const reversed = [...forward].reverse()

    expect(interpolatePolyline(forward, 0.25)).toEqual({ x: 10, y: 0 })
    expect(interpolatePolyline(reversed, 0.75)).toEqual({ x: 10, y: 0 })
    expect(isPointOnPolyline(reversed, interpolatePolyline(forward, 0.5))).toBe(true)
  })
})

function points(...values: ReadonlyArray<readonly [number, number]>): readonly CityPoint[] {
  return values.map(([x, y]) => ({ x, y }))
}
