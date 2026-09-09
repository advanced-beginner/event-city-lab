import type {
  CityPhysicalFacilityDefinition,
  CityPoint,
  CitySceneDefinition,
  CitySize,
} from './types'

export type AdvancedCityViewMode = 'focus' | 'overview'

export interface CityCamera {
  preserveAspectRatio: 'xMidYMid meet'
  sourceSize: CitySize
  viewBox: string
  viewBoxRect: CityCameraRect
}

export interface CityCameraRect extends CityPoint, CitySize {}

const DEFAULT_VIEWPORT_SIZE: CitySize = { width: 1280, height: 720 }
const FOCUS_MARGIN = 16
const VEHICLE_HALF_WIDTH = 64
const VEHICLE_TOP_OFFSET = 100
const VEHICLE_LABEL_BOTTOM_OFFSET = 64

export function getAdvancedCityCamera(
  scene: CitySceneDefinition,
  facilities: readonly CityPhysicalFacilityDefinition[],
  viewMode: AdvancedCityViewMode = 'focus',
  viewportSize: CitySize = DEFAULT_VIEWPORT_SIZE,
): CityCamera {
  const sourceSize = scene.viewport
  const overview = { x: 0, y: 0, width: sourceSize.width, height: sourceSize.height }
  const viewBoxRect = viewMode === 'overview'
    ? overview
    : fitRectToAspect(expandRect(contentBounds(scene, facilities), FOCUS_MARGIN), viewportSize, sourceSize)

  return {
    preserveAspectRatio: 'xMidYMid meet',
    sourceSize,
    viewBox: `${round(viewBoxRect.x)} ${round(viewBoxRect.y)} ${round(viewBoxRect.width)} ${round(viewBoxRect.height)}`,
    viewBoxRect,
  }
}

function contentBounds(
  scene: CitySceneDefinition,
  facilities: readonly CityPhysicalFacilityDefinition[],
): CityCameraRect {
  const points = [
    ...scene.mainRoad.points,
    ...scene.mainRoad.points.flatMap((point) => [
      { x: point.x - VEHICLE_HALF_WIDTH, y: point.y - VEHICLE_TOP_OFFSET },
      { x: point.x + VEHICLE_HALF_WIDTH, y: point.y - VEHICLE_TOP_OFFSET },
      { x: point.x - VEHICLE_HALF_WIDTH, y: point.y + VEHICLE_LABEL_BOTTOM_OFFSET },
      { x: point.x + VEHICLE_HALF_WIDTH, y: point.y + VEHICLE_LABEL_BOTTOM_OFFSET },
    ]),
    ...facilities.flatMap((facility) => [
      facility.position,
      { x: facility.position.x - 180, y: facility.position.y - 112 },
      { x: facility.position.x + 180, y: facility.position.y - 112 },
      { x: facility.position.x - 180, y: facility.position.y + 8 },
      { x: facility.position.x + 180, y: facility.position.y + 8 },
      { x: facility.position.x - 180, y: facility.position.y + 100 },
      { x: facility.position.x + 180, y: facility.position.y + 100 },
      ...pointsFromPath(facility.hitAreaPath),
    ]),
  ]
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

function expandRect(rect: CityCameraRect, margin: number): CityCameraRect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  }
}

function fitRectToAspect(rect: CityCameraRect, viewportSize: CitySize, sourceSize: CitySize): CityCameraRect {
  const aspect = viewportSize.width > 0 && viewportSize.height > 0
    ? viewportSize.width / viewportSize.height
    : DEFAULT_VIEWPORT_SIZE.width / DEFAULT_VIEWPORT_SIZE.height
  let width = rect.width
  let height = rect.height
  const currentAspect = width / height
  if (currentAspect < aspect) {
    width = height * aspect
  } else if (currentAspect > aspect) {
    height = width / aspect
  }

  width = Math.min(width, sourceSize.width)
  height = Math.min(height, sourceSize.height)
  const x = clamp(rect.x + rect.width / 2 - width / 2, 0, sourceSize.width - width)
  const y = clamp(rect.y + rect.height / 2 - height / 2, 0, sourceSize.height - height)
  return { x, y, width, height }
}

function pointsFromPath(path: string): CityPoint[] {
  const values = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]))
  const points: CityPoint[] = []
  for (let index = 0; index < values.length - 1; index += 2) {
    points.push({ x: values[index]!, y: values[index + 1]! })
  }
  return points
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Number(value.toFixed(2))
}
