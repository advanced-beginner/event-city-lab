import type { CityDirection, CityPoint } from './types'

export interface PolylineSegmentProjection {
  point: CityPoint
  segmentIndex: number
  segmentProgress: number
  distance: number
  routeProgress: number
}

export function polylineLength(points: readonly CityPoint[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(points[index - 1]!, points[index]!)
  }
  return total
}

export function interpolatePolyline(points: readonly CityPoint[], progress: number): CityPoint {
  const fallback = firstFinitePoint(points)
  if (!fallback) return { x: 0, y: 0 }

  const bounded = clampProgress(progress)
  const total = polylineLength(points)
  if (total === 0) return fallback

  let traveled = 0
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!
    const end = points[index]!
    const segmentLength = distanceBetween(start, end)
    if (segmentLength === 0) continue

    const target = total * bounded
    if (traveled + segmentLength >= target) {
      const segmentProgress = (target - traveled) / segmentLength
      return interpolatePoint(start, end, segmentProgress)
    }
    traveled += segmentLength
  }

  return points.at(-1) ?? fallback
}

/**
 * Determines the 4-way isometric heading ('ne' | 'se' | 'sw' | 'nw') at a given progress along a polyline.
 */
export function headingAtPolylineProgress(points: readonly CityPoint[], progress: number): CityDirection {
  const bounded = clampProgress(progress)
  const total = polylineLength(points)
  if (total === 0) return 'ne'

  const target = total * bounded
  let traveled = 0
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!
    const end = points[index]!
    const segmentLength = distanceBetween(start, end)
    if (segmentLength === 0) continue

    if (traveled + segmentLength >= target || index === points.length - 1) {
      return directionFromVector(end.x - start.x, end.y - start.y)
    }
    traveled += segmentLength
  }

  return 'ne'
}

/**
 * Extracts a contiguous sub-polyline between two progress values (supports forward and reverse slices).
 */
export function slicePolylineByProgress(
  points: readonly CityPoint[],
  startProgress: number,
  endProgress: number,
): readonly CityPoint[] {
  const start = clampProgress(startProgress)
  const end = clampProgress(endProgress)
  const startPoint = interpolatePolyline(points, start)
  const endPoint = interpolatePolyline(points, end)
  const total = polylineLength(points)
  if (total === 0 || Math.abs(end - start) < 0.0001) {
    return [startPoint, endPoint]
  }

  const forward = end >= start
  const minP = Math.min(start, end)
  const maxP = Math.max(start, end)
  const collected: CityPoint[] = [interpolatePolyline(points, minP)]

  let traveled = 0
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1]!
    const curr = points[index]!
    traveled += distanceBetween(prev, curr)
    const vertexProgress = traveled / total
    if (vertexProgress > minP + 0.0001 && vertexProgress < maxP - 0.0001) {
      collected.push(curr)
    }
  }

  collected.push(interpolatePolyline(points, maxP))
  return forward ? collected : [...collected].reverse()
}

export function directionFromVector(dx: number, dy: number): CityDirection {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 'ne'
  if (dx >= 0) {
    return dy <= 0 ? 'ne' : 'se'
  }
  return dy >= 0 ? 'sw' : 'nw'
}

export function nearestPointOnPolyline(points: readonly CityPoint[], point: CityPoint): PolylineSegmentProjection {
  const fallback = firstFinitePoint(points) ?? { x: 0, y: 0 }
  const total = polylineLength(points)
  let traveled = 0
  let best: PolylineSegmentProjection = {
    point: fallback,
    segmentIndex: 0,
    segmentProgress: 0,
    distance: distanceBetween(fallback, point),
    routeProgress: 0,
  }

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!
    const end = points[index]!
    const segmentLength = distanceBetween(start, end)
    if (segmentLength === 0) continue

    const segmentProgress = nearestSegmentProgress(start, end, point)
    const candidatePoint = interpolatePoint(start, end, segmentProgress)
    const candidateDistance = distanceBetween(candidatePoint, point)
    if (candidateDistance < best.distance) {
      best = {
        point: candidatePoint,
        segmentIndex: index - 1,
        segmentProgress,
        distance: candidateDistance,
        routeProgress: total === 0 ? 0 : (traveled + segmentLength * segmentProgress) / total,
      }
    }

    traveled += segmentLength
  }

  return best
}

export function isPointOnPolyline(points: readonly CityPoint[], point: CityPoint, tolerance = 0.001): boolean {
  return nearestPointOnPolyline(points, point).distance <= tolerance
}

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(1, progress))
}

function firstFinitePoint(points: readonly CityPoint[]): CityPoint | null {
  return points.find((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) ?? null
}

function distanceBetween(start: CityPoint, end: CityPoint): number {
  return Math.hypot(end.x - start.x, end.y - start.y)
}

function interpolatePoint(start: CityPoint, end: CityPoint, progress: number): CityPoint {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  }
}

function nearestSegmentProgress(start: CityPoint, end: CityPoint, point: CityPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return 0
  return clampProgress(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
}
