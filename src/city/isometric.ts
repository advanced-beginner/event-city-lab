import type { CityDirection, CityGridBounds, CityPoint, CitySize } from './types'

export const DIORAMA_VIEWPORT: CitySize = { width: 1600, height: 900 }
export const ISO_ORIGIN: CityPoint = { x: 220, y: 470 }
export const ISO_TILE_HALF_W = 58
export const ISO_TILE_HALF_H = 29

/**
 * Projects 2:1 isometric grid coordinates (u: NE, v: SE, z: up px) into SVG viewport coordinates.
 */
export function isoPoint(u: number, v: number, z = 0): CityPoint {
  return {
    x: round(ISO_ORIGIN.x + (u + v) * ISO_TILE_HALF_W),
    y: round(ISO_ORIGIN.y + (v - u) * ISO_TILE_HALF_H - z),
  }
}

/**
 * Computes screen offset relative to a local origin (0, 0) for vehicle/prop sub-geometry.
 */
export function localIsoPoint(du: number, dv: number, z = 0): CityPoint {
  return {
    x: round((du + dv) * ISO_TILE_HALF_W),
    y: round((dv - du) * ISO_TILE_HALF_H - z),
  }
}

export function pointsToPolygon(points: readonly CityPoint[]): string {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')
}

export function pointsToSvgPath(points: readonly CityPoint[], closed = false): string {
  if (points.length === 0) return ''
  const commands = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
  return closed ? `${commands.join(' ')} Z` : commands.join(' ')
}

export interface IsoPrismGeometry {
  topFace: string
  leftFace: string
  rightFace: string
  shadowFace: string
  outlinePath: string
  topBevelPath: string
  topCenter: CityPoint
  baseCenter: CityPoint
  corners: {
    n: CityPoint
    e: CityPoint
    s: CityPoint
    w: CityPoint
    nt: CityPoint
    et: CityPoint
    st: CityPoint
    wt: CityPoint
  }
}

/**
 * Generates an isometric 3D box centered at (u, v) with top, left (SW), right (SE), and shadow faces.
 */
export function createIsoPrism(
  u: number,
  v: number,
  sizeU: number,
  sizeV: number,
  height: number,
  zBase = 0,
): IsoPrismGeometry {
  const hu = sizeU / 2
  const hv = sizeV / 2

  const n = isoPoint(u + hu, v - hv, zBase)
  const e = isoPoint(u + hu, v + hv, zBase)
  const s = isoPoint(u - hu, v + hv, zBase)
  const w = isoPoint(u - hu, v - hv, zBase)

  const nt = isoPoint(u + hu, v - hv, zBase + height)
  const et = isoPoint(u + hu, v + hv, zBase + height)
  const st = isoPoint(u - hu, v + hv, zBase + height)
  const wt = isoPoint(u - hu, v - hv, zBase + height)

  const shadowOffsetU = -0.12
  const shadowOffsetV = 0.28
  const sn = isoPoint(u + hu + shadowOffsetU, v - hv + shadowOffsetV, zBase)
  const se = isoPoint(u + hu + shadowOffsetU, v + hv + shadowOffsetV, zBase)
  const ss = isoPoint(u - hu + shadowOffsetU, v + hv + shadowOffsetV, zBase)
  const sw = isoPoint(u - hu + shadowOffsetU, v - hv + shadowOffsetV, zBase)

  return {
    topFace: pointsToPolygon([wt, nt, et, st]),
    leftFace: pointsToPolygon([wt, st, s, w]),
    rightFace: pointsToPolygon([st, et, e, s]),
    shadowFace: pointsToPolygon([sw, sn, se, ss]),
    outlinePath: pointsToSvgPath([wt, nt, et, e, s, w], true),
    topBevelPath: pointsToSvgPath([wt, nt, et]),
    topCenter: isoPoint(u, v, zBase + height),
    baseCenter: isoPoint(u, v, zBase),
    corners: { n, e, s, w, nt, et, st, wt },
  }
}

export interface LocalIsoBoxGeometry {
  topFace: string
  leftFace: string
  rightFace: string
  topHighlightPath: string
  depthScore: number
}

/**
 * Generates an axis-aligned 3D box in local isometric coordinates relative to a moving entity.
 */
export function createLocalIsoBox(
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
  zMin: number,
  zMax: number,
): LocalIsoBoxGeometry {
  const n = localIsoPoint(uMax, vMin, zMin)
  const e = localIsoPoint(uMax, vMax, zMin)
  const s = localIsoPoint(uMin, vMax, zMin)
  const w = localIsoPoint(uMin, vMin, zMin)

  const nt = localIsoPoint(uMax, vMin, zMax)
  const et = localIsoPoint(uMax, vMax, zMax)
  const st = localIsoPoint(uMin, vMax, zMax)
  const wt = localIsoPoint(uMin, vMin, zMax)

  // Depth score increases toward camera (-u, +v) and upward (+z).
  const centerU = (uMin + uMax) / 2
  const centerV = (vMin + vMax) / 2
  const centerZ = (zMin + zMax) / 2
  const depthScore = (centerV - centerU) * 100 + centerZ

  void n
  return {
    topFace: pointsToPolygon([wt, nt, et, st]),
    leftFace: pointsToPolygon([wt, st, s, w]),
    rightFace: pointsToPolygon([st, et, e, s]),
    topHighlightPath: pointsToSvgPath([wt, nt, et]),
    depthScore,
  }
}

export interface IsoShadedPalette {
  top: string
  left: string
  right: string
  bevel: string
}

/**
 * Computes 3-point isometric lighting tones: Top 100%, Left 82%, Right 64%, Bevel +16%.
 */
export function shadeIsoFaces(baseHex: string): IsoShadedPalette {
  return {
    top: adjustHexBrightness(baseHex, 1),
    left: adjustHexBrightness(baseHex, 0.82),
    right: adjustHexBrightness(baseHex, 0.64),
    bevel: adjustHexBrightness(baseHex, 1.18),
  }
}

export interface DioramaCutawayBaseGeometry {
  topDeck: string
  leftCutaway: string
  rightCutaway: string
  leftSubStratum: string
  rightSubStratum: string
  dropShadow: string
  deckRimPath: string
  gridPaths: readonly string[]
}

/**
 * Generates the cutaway diorama slab and top isometric grid lines.
 */
export function createDioramaBase(bounds: CityGridBounds, thickness = 42): DioramaCutawayBaseGeometry {
  const { minU, maxU, minV, maxV } = bounds
  const topW = isoPoint(minU, minV, 0)
  const topN = isoPoint(maxU, minV, 0)
  const topE = isoPoint(maxU, maxV, 0)
  const topS = isoPoint(minU, maxV, 0)

  const midHeight = Math.round(thickness * 0.56)
  const midW = isoPoint(minU, minV, -midHeight)
  const midS = isoPoint(minU, maxV, -midHeight)
  const midE = isoPoint(maxU, maxV, -midHeight)

  const botW = isoPoint(minU, minV, -thickness)
  const botS = isoPoint(minU, maxV, -thickness)
  const botE = isoPoint(maxU, maxV, -thickness)

  const shadowOffset = thickness + 18
  const shW = isoPoint(minU - 0.14, minV + 0.18, -shadowOffset)
  const shN = isoPoint(maxU - 0.14, minV + 0.18, -shadowOffset)
  const shE = isoPoint(maxU - 0.14, maxV + 0.18, -shadowOffset)
  const shS = isoPoint(minU - 0.14, maxV + 0.18, -shadowOffset)

  const gridPaths: string[] = []
  for (let u = Math.ceil(minU); u <= Math.floor(maxU); u += 1) {
    gridPaths.push(pointsToSvgPath([isoPoint(u, minV, 0), isoPoint(u, maxV, 0)]))
  }
  for (let v = Math.ceil(minV); v <= Math.floor(maxV); v += 1) {
    gridPaths.push(pointsToSvgPath([isoPoint(minU, v, 0), isoPoint(maxU, v, 0)]))
  }

  return {
    topDeck: pointsToPolygon([topW, topN, topE, topS]),
    leftCutaway: pointsToPolygon([topW, topS, midS, midW]),
    rightCutaway: pointsToPolygon([topS, topE, midE, midS]),
    leftSubStratum: pointsToPolygon([midW, midS, botS, botW]),
    rightSubStratum: pointsToPolygon([midS, midE, botE, botS]),
    dropShadow: pointsToPolygon([shW, shN, shE, shS]),
    deckRimPath: pointsToSvgPath([topW, topN, topE]),
    gridPaths,
  }
}

export interface LocalVehicleBox {
  id: string
  geometry: LocalIsoBoxGeometry
  palette: IsoShadedPalette
  stroke: string
}

export interface IsoPostalVanGeometry {
  shadowPolygon: string
  boxes: readonly LocalVehicleBox[]
  windshieldPolygon: string
  headlights: readonly CityPoint[]
  taillights: readonly CityPoint[]
  wheels: readonly CityPoint[]
  roofBeacon: CityPoint
}

/**
 * Generates 3D isometric polygons for a postal delivery van oriented in 4 isometric directions.
 */
export function createIsoPostalVan(
  heading: CityDirection,
  bodyHex = '#f5b82e',
  cabHex = '#ffd666',
  scale = 1,
): IsoPostalVanGeometry {
  const s = scale
  // Rotate vehicle local coordinates (forward f, right r) into isometric (du, dv)
  const toDuDv = (f: number, r: number): [number, number] => {
    switch (heading) {
      case 'ne':
        return [f, r]
      case 'se':
        return [-r, f]
      case 'sw':
        return [-f, -r]
      case 'nw':
        return [r, -f]
    }
  }

  const makeOrientedBounds = (f0: number, f1: number, r0: number, r1: number): [number, number, number, number] => {
    const corners = [
      toDuDv(f0, r0),
      toDuDv(f0, r1),
      toDuDv(f1, r0),
      toDuDv(f1, r1),
    ]
    const us = corners.map(([u]) => u)
    const vs = corners.map(([, v]) => v)
    return [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)]
  }

  const cargoBounds = makeOrientedBounds(-0.34 * s, 0.14 * s, -0.17 * s, 0.17 * s)
  const cabBounds = makeOrientedBounds(0.14 * s, 0.36 * s, -0.15 * s, 0.15 * s)
  const stripeBounds = makeOrientedBounds(-0.28 * s, 0.08 * s, -0.12 * s, 0.12 * s)

  const cargoBox: LocalVehicleBox = {
    id: 'cargo',
    geometry: createLocalIsoBox(...cargoBounds, 6 * s, 26 * s),
    palette: shadeIsoFaces(bodyHex),
    stroke: '#422006',
  }
  const cabBox: LocalVehicleBox = {
    id: 'cab',
    geometry: createLocalIsoBox(...cabBounds, 5 * s, 21 * s),
    palette: shadeIsoFaces(cabHex),
    stroke: '#422006',
  }
  const roofBox: LocalVehicleBox = {
    id: 'roof-parcel',
    geometry: createLocalIsoBox(...stripeBounds, 26 * s, 30 * s),
    palette: shadeIsoFaces('#fffbeb'),
    stroke: '#92400e',
  }

  // Painter's algorithm sort: rear-to-front then bottom-to-top
  const boxes = [cargoBox, cabBox, roofBox].sort((a, b) => a.geometry.depthScore - b.geometry.depthScore)

  const shadowBounds = makeOrientedBounds(-0.39 * s, 0.41 * s, -0.22 * s, 0.22 * s)
  const shadowPolygon = pointsToPolygon([
    localIsoPoint(shadowBounds[0] - 0.04, shadowBounds[2] + 0.06, 0),
    localIsoPoint(shadowBounds[1] - 0.04, shadowBounds[2] + 0.06, 0),
    localIsoPoint(shadowBounds[1] - 0.04, shadowBounds[3] + 0.06, 0),
    localIsoPoint(shadowBounds[0] - 0.04, shadowBounds[3] + 0.06, 0),
  ])

  const windshieldCorners = [
    toDuDv(0.36 * s, -0.12 * s),
    toDuDv(0.36 * s, 0.12 * s),
    toDuDv(0.24 * s, 0.12 * s),
    toDuDv(0.24 * s, -0.12 * s),
  ]
  const windshieldPolygon = pointsToPolygon([
    localIsoPoint(windshieldCorners[0]![0], windshieldCorners[0]![1], 14 * s),
    localIsoPoint(windshieldCorners[1]![0], windshieldCorners[1]![1], 14 * s),
    localIsoPoint(windshieldCorners[2]![0], windshieldCorners[2]![1], 20.5 * s),
    localIsoPoint(windshieldCorners[3]![0], windshieldCorners[3]![1], 20.5 * s),
  ])

  const frontLeft = toDuDv(0.37 * s, -0.1 * s)
  const frontRight = toDuDv(0.37 * s, 0.1 * s)
  const rearLeft = toDuDv(-0.35 * s, -0.11 * s)
  const rearRight = toDuDv(-0.35 * s, 0.11 * s)

  const wheelFront = heading === 'ne' || heading === 'se'
    ? toDuDv(0.22 * s, 0.16 * s)
    : toDuDv(0.22 * s, -0.16 * s)
  const wheelRear = heading === 'ne' || heading === 'se'
    ? toDuDv(-0.18 * s, 0.17 * s)
    : toDuDv(-0.18 * s, -0.17 * s)

  const beaconPos = toDuDv(0.23 * s, 0)

  return {
    shadowPolygon,
    boxes,
    windshieldPolygon,
    headlights: [
      localIsoPoint(frontLeft[0], frontLeft[1], 8 * s),
      localIsoPoint(frontRight[0], frontRight[1], 8 * s),
    ],
    taillights: [
      localIsoPoint(rearLeft[0], rearLeft[1], 9 * s),
      localIsoPoint(rearRight[0], rearRight[1], 9 * s),
    ],
    wheels: [
      localIsoPoint(wheelFront[0], wheelFront[1], 4 * s),
      localIsoPoint(wheelRear[0], wheelRear[1], 4 * s),
    ],
    roofBeacon: localIsoPoint(beaconPos[0], beaconPos[1], 23 * s),
  }
}

function adjustHexBrightness(hex: string, factor: number): string {
  const clean = hex.replace('#', '')
  const normalized = clean.length === 3
    ? clean.split('').map((ch) => ch + ch).join('')
    : clean
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  if ([r, g, b].some((channel) => Number.isNaN(channel))) return hex

  const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  const nr = clampChannel(r * factor)
  const ng = clampChannel(g * factor)
  const nb = clampChannel(b * factor)
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

function round(value: number): number {
  return Number(value.toFixed(2))
}
