import { useMemo } from 'react'

import atlasUrl from '../assets/city/background/event-city-atlas.webp'
import { getAdvancedCityCamera, type AdvancedCityViewMode } from '../city/camera'
import { projectCityWorld } from '../city/projection'
import { interpolatePolyline } from '../city/routeGeometry'
import type {
  CityCarrierState,
  CityNodeState,
  CityPhysicalFacilityDefinition,
  CityPoint,
  CityRouteDefinition,
  CityRouteState,
  CitySceneDefinition,
  CityVisualState,
} from '../city/types'
import type { CityScenePreview } from '../city/chapterScenes'
import type { ChapterSimulationEvent } from '../domain/chapterSimulation'

import { CityFacility } from './CityFacility'
import { CitySprite } from './CitySprite'
import { CityWorld } from './CityWorld'
import styles from './AdvancedCityWorld.module.css'

interface AdvancedCityWorldProps {
  carrierProgress?: number
  cursor: number
  events: readonly ChapterSimulationEvent[]
  isPlaying?: boolean
  onInspect: (nodeId: string) => void
  pendingRerun: boolean
  preview?: CityScenePreview
  reducedMotion: boolean
  runStatus?: 'failed' | 'succeeded'
  scene: CitySceneDefinition
  viewportSize?: { width: number; height: number }
  viewMode?: AdvancedCityViewMode
}

const STATE_LABELS: Record<CityVisualState, string> = {
  idle: '대기',
  active: '처리 중',
  blocked: '차단',
  failed: '실패',
  complete: '완료',
  muted: '비활성',
}

const EMPTY_PREVIEW: CityScenePreview = { nodeIds: [], routeIds: [] }

interface CityHudItem {
  icon: string
  key: string
  label: string
  state: CityVisualState
}

export function AdvancedCityWorld({
  carrierProgress,
  cursor,
  events,
  isPlaying = false,
  onInspect,
  pendingRerun,
  preview = EMPTY_PREVIEW,
  reducedMotion,
  runStatus,
  scene,
  viewportSize,
  viewMode = 'focus',
}: AdvancedCityWorldProps) {
  const world = useMemo(() => projectCityWorld(scene, events, cursor), [cursor, events, scene])
  const nodes = Object.values(world.nodes)
  const routes = Object.values(world.routes)
  const carriers = Object.values(world.carriers)
  const physicalFacilities = groupPhysicalFacilities(scene, nodes)
  const camera = useMemo(
    () => getAdvancedCityCamera(scene, physicalFacilities.map((facility) => facility.definition), viewMode, viewportSize),
    [physicalFacilities, scene, viewMode, viewportSize],
  )
  const carrierLayouts = layoutCarriers(carriers, scene, carrierProgress)
  const visibleRouteId = carrierLayouts[0]?.route.id
  const showPreview = cursor < 0 && events.length === 0
  const visibleRouteIds = new Set([
    ...(visibleRouteId ? [visibleRouteId] : []),
    ...(showPreview ? preview.routeIds : []),
  ])
  const visibleRoutes = uniquePhysicalRoutes(routes.filter((route) => visibleRouteIds.has(route.id)))
  const hudItems = cityHudItems(scene, world, pendingRerun)

  return (
    <div
      className={`${styles.worldFrame} ${pendingRerun ? styles.pending : ''}`}
      data-advanced-city
      data-city-view-mode={viewMode}
      data-city-run-status={runStatus ?? 'running'}
      data-city-playing={isPlaying ? 'true' : 'false'}
      data-city-motion-active={isPlaying && !runStatus && !reducedMotion ? 'true' : 'false'}
    >
      <CityWorld
        backgroundUrl={atlasUrl}
        backgroundSize={camera.sourceSize}
        className={styles.world}
        imageClassName={styles.backdrop}
        viewBox={camera.viewBox}
        preserveAspectRatio={camera.preserveAspectRatio}
        reducedMotion={reducedMotion}
        title={`${scene.label} Kafka 도시 시뮬레이션`}
        description="선택 가능한 Kafka 시설과 도로 위 이동 차량, 제어 신호, 실패 차단기가 동일한 이벤트 타임라인에 맞춰 변합니다."
      >
        <defs>
          <filter id="advanced-city-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#68fff4" floodOpacity=".85" />
          </filter>
          <filter id="advanced-city-shadow" x="-60%" y="-60%" width="220%" height="240%">
            <feDropShadow dx="0" dy="12" stdDeviation="10" floodColor="#173341" floodOpacity=".48" />
          </filter>
        </defs>

        <rect className={styles.wash} width={camera.sourceSize.width} height={camera.sourceSize.height} aria-hidden="true" />

        <g className={styles.routeLayer} aria-hidden="true">
          <g className={styles.mainRoadGuide} data-city-main-road={scene.mainRoad.id}>
            <path className={styles.mainRoadGuideHalo} d={scene.mainRoad.path} />
            <path className={styles.mainRoadGuideLine} d={scene.mainRoad.path} />
            <circle className={styles.mainRoadAnchor} cx={scene.mainRoad.points[0]?.x} cy={scene.mainRoad.points[0]?.y} r="12" />
            <circle className={styles.mainRoadAnchor} cx={scene.mainRoad.points.at(-1)?.x} cy={scene.mainRoad.points.at(-1)?.y} r="12" />
          </g>
          {visibleRoutes.map((route) => (
            <CityRoute key={route.id} route={route} previewed={showPreview && preview.routeIds.includes(route.id)} />
          ))}
        </g>

        <g className={styles.facilityLayer}>
          {physicalFacilities.map((facility) => {
            const roadAccess = scene.mainRoad.points[facility.roadAccessIndex]
            return (
              <g key={facility.definition.id} data-city-facility-slot={facility.definition.id}>
                {roadAccess && (
                  <g className={styles.facilityRoadLink} aria-hidden="true">
                    <path d={`M${roadAccess.x} ${roadAccess.y} L${facility.position.x} ${facility.position.y}`} />
                    <circle cx={roadAccess.x} cy={roadAccess.y} r="8" />
                  </g>
                )}
                <CityFacility
                  nodeId={facility.definition.id}
                  accessibleName={physicalFacilityAccessibleName(facility)}
                  onInspect={onInspect}
                  hitAreaPath={facility.hitAreaPath}
                  hitAreaClassName={styles.hitArea}
                  className={`${styles.facility} ${styles[facility.state] ?? ''} ${facility.focused ? styles.focused : ''} ${showPreview && facility.nodes.some((node) => preview.nodeIds.includes(node.id)) ? styles.previewFacility : ''}`}
                >
                  <FacilitySign facility={facility} previewNodeIds={showPreview ? preview.nodeIds : []} />
                </CityFacility>
              </g>
            )
          })}
        </g>

        <g className={styles.carrierLayer} aria-label="집계 메시지 차량">
          {carrierLayouts.map((layout) => (
            <CityCarrier
              key={layout.carrier.id}
              {...layout}
            />
          ))}
        </g>

        {world.signal && (
          <SignalOverlay
            to={world.nodes[world.signal.toNodeId]?.position}
            kind={world.signal.kind}
            state={world.signal.state}
          />
        )}

        {world.barrier && <BarrierOverlay scene={scene} barrier={world.barrier} />}
      </CityWorld>
      {hudItems.length > 0 && (
        <div className={styles.cityHud} data-city-hud>
          {hudItems.map((item) => (
            <div key={item.key} className={`${styles.hudChip} ${styles[item.state] ?? ''}`} data-city-hud-item={item.key}>
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CityRoute({ route, previewed }: { route: CityRouteState; previewed: boolean }) {
  return (
    <g
      data-city-route={route.id}
      data-route-kind={route.kind}
      data-route-state={route.state}
      className={`${styles.route} ${styles[`route_${route.kind}`]} ${styles[`route_${route.state}`]} ${route.disabled ? styles.routeDisabled : ''} ${previewed ? styles.previewRoute : ''}`}
    >
      <path className={styles.routeHalo} d={route.path} />
      <path className={styles.routeLine} d={route.path} />
    </g>
  )
}

function uniquePhysicalRoutes(routes: CityRouteState[]): CityRouteState[] {
  const seenPaths = new Set<string>()
  return routes.filter((route) => {
    const key = `${route.kind}:${route.path}`
    if (seenPaths.has(key)) return false
    seenPaths.add(key)
    return true
  })
}

interface PhysicalFacility {
  definition: CityPhysicalFacilityDefinition
  displayLabel: string
  focused: boolean
  hitAreaPath: string
  kafkaLabel: string
  label: string
  nodes: readonly CityNodeState[]
  position: CityPoint
  representative: CityNodeState
  roadAccessIndex: number
  state: CityVisualState
}

function groupPhysicalFacilities(scene: CitySceneDefinition, nodes: readonly CityNodeState[]): PhysicalFacility[] {
  const grouped = new Map<number, CityNodeState[]>()
  for (const node of nodes) {
    const group = grouped.get(node.roadAccessIndex) ?? []
    group.push(node)
    grouped.set(node.roadAccessIndex, group)
  }

  return scene.physicalFacilities
    .filter((facility) => grouped.has(facility.roadAccessIndex))
    .sort((left, right) => left.roadAccessIndex - right.roadAccessIndex)
    .map((definition) => {
      const facilityNodes = grouped.get(definition.roadAccessIndex) ?? []
      const representative = facilityNodes[0]!
      const state = facilityNodes.reduce<CityVisualState>(
        (current, node) => visualStatePriority(node.state) > visualStatePriority(current) ? node.state : current,
        'idle',
      )
      return {
        definition,
        displayLabel: physicalFacilityDisplayLabel(definition),
        focused: facilityNodes.some((node) => node.focused),
        hitAreaPath: definition.hitAreaPath,
        kafkaLabel: physicalFacilityKafkaLabel(definition),
        label: definition.label,
        nodes: facilityNodes,
        position: definition.position,
        representative,
        roadAccessIndex: definition.roadAccessIndex,
        state,
      }
    })
}

function physicalFacilityAccessibleName(facility: PhysicalFacility): string {
  const logicalStates = facility.nodes.length > 1
    ? `, ${facility.nodes.map((node) => `${node.label} ${node.badge ?? STATE_LABELS[node.state]}`).join(', ')}`
    : ''
  return `${facility.displayLabel} (${facility.kafkaLabel}), ${STATE_LABELS[facility.state]}${logicalStates}`
}

function physicalFacilityDisplayLabel(facility: CityPhysicalFacilityDefinition): string {
  return ({
    'slot-source': '출발지',
    'slot-ingress': '인입 관문',
    'slot-cluster': '클러스터',
    'slot-consumer': '수신 처리',
    'slot-application': '애플리케이션',
  } as const)[facility.id] ?? facility.label
}

function physicalFacilityKafkaLabel(facility: CityPhysicalFacilityDefinition): string {
  return facility.label
}

function visualStatePriority(state: CityVisualState): number {
  return ({ failed: 5, blocked: 4, active: 3, complete: 2, muted: 1, idle: 0 } as const)[state]
}

function cityHudItems(
  scene: CitySceneDefinition,
  world: ReturnType<typeof projectCityWorld>,
  pendingRerun: boolean,
): CityHudItem[] {
  const items: CityHudItem[] = []
  if (pendingRerun) {
    items.push({ icon: '↻', key: 'pending-rerun', label: '수정 대기 · 재실행 필요', state: 'blocked' })
  }
  if (world.barrier) {
    const state: CityVisualState = world.barrier.state === 'closed' ? 'blocked' : 'complete'
    items.push({
      icon: world.barrier.state === 'closed' ? '!' : '✓',
      key: `barrier-${world.barrier.state}`,
      label: world.barrier.label,
      state,
    })
  }
  if (world.signal) {
    const control = world.signal.kind === 'metadata'
      || world.signal.kind === 'assignment'
      || world.signal.kind === 'revocation'
      || world.signal.kind.startsWith('tx-')
    const icon = world.signal.state === 'failed' || world.signal.state === 'blocked'
      ? '!'
      : control
        ? '↺'
        : '✓'
    items.push({
      icon,
      key: `signal-${world.signal.kind}`,
      label: world.signal.label,
      state: world.signal.state,
    })
  }
  for (const boundary of scene.boundaries ?? []) {
    const boundaryNodes = boundary.nodeIds.flatMap((nodeId) => world.nodes[nodeId] ? [world.nodes[nodeId]] : [])
    const state = boundaryNodes.reduce<CityVisualState>(
      (current, node) => visualStatePriority(node.state) > visualStatePriority(current) ? node.state : current,
      'idle',
    )
    const focused = boundary.nodeIds.some((nodeId) => world.focusNodeIds.includes(nodeId))
    if (state === 'idle' && !focused) continue
    items.push({ icon: 'TX', key: `boundary-${boundary.id}`, label: boundary.label, state: state === 'idle' ? 'active' : state })
  }
  return items
}

function FacilitySign({
  facility,
  previewNodeIds,
}: {
  facility: PhysicalFacility
  previewNodeIds: readonly string[]
}) {
  const signLabel = `${facility.displayLabel} / ${facility.kafkaLabel}`
  const width = Math.max(250, Math.min(360, signLabel.length * 12 + 92))
  const x = facility.position.x - width / 2
  const y = facility.definition.id === 'slot-consumer' ? facility.position.y + 8 : facility.position.y - 92
  return (
    <g className={styles.facilitySign} transform={`translate(${x} ${y})`}>
      <rect width={width} height="62" rx="10" />
      <circle cx="22" cy="24" r="8" data-state={facility.state} />
      <text x="40" y="30">{facility.displayLabel}</text>
      <text x="40" y="51">{facility.kafkaLabel}</text>
      <text className={styles.facilityStateText} x={width - 18} y="42" textAnchor="end">{STATE_LABELS[facility.state]}</text>
      {facility.nodes.length > 1 && facility.nodes.length <= 3 && (
        <g className={styles.logicalBadges} transform={`translate(${width / 2} 72)`}>
          {facility.nodes.map((node, index) => {
            const badgeLabel = logicalBadgeLabel(node)
            const badgeWidth = logicalBadgeWidth(badgeLabel)
            const totalWidth = facility.nodes.reduce(
              (sum, candidate) => sum + logicalBadgeWidth(logicalBadgeLabel(candidate)) + 6,
              -6,
            )
            const precedingWidth = facility.nodes.slice(0, index).reduce(
              (sum, candidate) => sum + logicalBadgeWidth(logicalBadgeLabel(candidate)) + 6,
              0,
            )
            return (
              <g
                key={node.id}
                transform={`translate(${-totalWidth / 2 + precedingWidth} 0)`}
                data-logical-node={node.id}
                data-logical-state={node.state}
                data-logical-preview={previewNodeIds.includes(node.id) ? 'true' : 'false'}
              >
                <rect width={badgeWidth} height="30" rx="8" />
                <text x={badgeWidth / 2} y="20" textAnchor="middle">{badgeLabel}</text>
              </g>
            )
          })}
        </g>
      )}
      {facility.nodes.length > 3 && (
        <LogicalSummary facility={facility} previewNodeIds={previewNodeIds} width={width} />
      )}
    </g>
  )
}

function logicalBadgeLabel(node: CityNodeState): string {
  const status = node.badge ?? STATE_LABELS[node.state]
  const label = node.label
    .replace(/^Follower\s+/i, 'f')
    .replace(/^Broker\s+/i, '')
    .replace(/\s+/g, '')
  return `${label} · ${status}`
}

function logicalBadgeWidth(label: string): number {
  return Math.max(64, Math.min(132, label.length * 8 + 28))
}

function LogicalSummary({
  facility,
  previewNodeIds,
  width,
}: {
  facility: PhysicalFacility
  previewNodeIds: readonly string[]
  width: number
}) {
  const previewed = facility.nodes.filter((node) => previewNodeIds.includes(node.id))
  const focused = facility.nodes.filter((node) => node.focused)
  const summary = previewed.length > 0
    ? `선택 ${previewed.map((node) => node.label).join(' · ')}`
    : focused.length > 0
      ? `${focused.map((node) => node.label).join(' · ')} · ${STATE_LABELS[facility.state]}`
      : `${facility.nodes.length}개 논리 역할 · ${facility.nodes.filter((node) => node.state === 'active').length} 활성`
  return (
    <g
      className={styles.logicalSummary}
      transform={`translate(${width / 2 - 108} 72)`}
      data-logical-preview={previewed.length > 0 ? 'true' : 'false'}
    >
      <rect width="216" height="30" rx="8" />
      <title>{summary}</title>
      <text x="108" y="20" textAnchor="middle">
        {compactSummary(summary)}
      </text>
    </g>
  )
}

function compactSummary(label: string): string {
  let units = 0
  let result = ''
  for (const character of label) {
    units += character.charCodeAt(0) > 255 ? 2 : 1
    if (units > 25) return `${result}…`
    result += character
  }
  return result
}

function CityCarrier({
  carrier,
  offsetX,
  position,
  progress,
  route,
}: CarrierLayout) {
  const label = carrierLabel(carrier)
  const isTicket = carrier.kind === 'offset-ticket'

  return (
    <g
      transform={`translate(${position.x + offsetX} ${position.y})`}
      className={`${styles.carrier} ${styles[carrier.state ?? 'active'] ?? ''} ${styles[`carrier_${carrier.kind}`]}`}
      data-city-carrier={carrier.id}
      data-carrier-kind={carrier.kind}
      data-carrier-cue-count={carrierCueCount(carrier)}
      data-carrier-direction="forward"
      data-carrier-progress={progress.toFixed(3)}
      data-carrier-route={route.id}
      data-motion-mode="external"
    >
      {isTicket ? (
        <g className={styles.ticket}>
          <rect x="-34" y="-42" width="68" height="42" rx="7" />
          <path d="M-21-28h42M-21-17h30" />
          <text x="0" y="14" textAnchor="middle">OFFSET</text>
        </g>
      ) : (
        <CitySprite id="vehicle-kafka-van-northeast" x={0} y={0} scale={0.55} />
      )}
      {carrier.state === 'failed' && (
        <g className={styles.carrierError} transform="translate(42 -112)" aria-hidden="true">
          <circle r="25" />
          <text y="9" textAnchor="middle">!</text>
        </g>
      )}
      <g className={styles.cargoLabel} transform={`translate(${-Math.max(144, label.length * 9 + 30) / 2} 24)`}>
        <rect width={Math.max(144, label.length * 9 + 30)} height="28" rx="7" />
        <text x={Math.max(144, label.length * 9 + 30) / 2} y="19" textAnchor="middle">{label}</text>
      </g>
    </g>
  )
}

function SignalOverlay({
  kind,
  state,
  to,
}: {
  kind: string
  state: CityVisualState
  to: CityPoint | undefined
}) {
  if (!to) return null
  const control = kind === 'metadata' || kind === 'assignment' || kind === 'revocation' || kind.startsWith('tx-')
  const marker = state === 'failed' || state === 'blocked'
    ? 'failed'
    : control
      ? 'control'
      : 'success'
  return (
    <g className={`${styles.signal} ${control ? styles.controlSignal : styles.successSignal} ${styles[state] ?? ''}`} data-city-signal={kind}>
      <g className={styles.signalPulse} transform={`translate(${to.x} ${to.y})`} data-signal-marker={marker}>
        <circle r="22" />
        <circle r="9" />
      </g>
    </g>
  )
}

function BarrierOverlay({
  barrier,
  scene,
}: {
  barrier: NonNullable<ReturnType<typeof projectCityWorld>['barrier']>
  scene: CitySceneDefinition
}) {
  const position = barrierPosition(scene, barrier.routeId, barrier.checkpointId, barrier.nodeId)
  if (!position) return null
  return (
    <g className={`${styles.barrier} ${barrier.state === 'closed' ? styles.barrierClosed : styles.barrierOpen}`} transform={`translate(${position.x} ${position.y})`} data-city-barrier={barrier.state}>
      <path d="M-44 0H44M-34-18 34 18M-34 18 34-18" />
    </g>
  )
}

function carrierRoute(carrier: CityCarrierState, scene: CitySceneDefinition): CityRouteDefinition | null {
  const route = scene.routes.find((candidate) => candidate.id === carrier.routeId)
  return route ?? null
}

interface CarrierLayout {
  carrier: CityCarrierState
  offsetX: number
  position: CityPoint
  progress: number
  route: CityRouteDefinition
}

function layoutCarriers(
  carriers: readonly CityCarrierState[],
  scene: CitySceneDefinition,
  carrierProgress: number | undefined,
): CarrierLayout[] {
  const baseLayouts = carriers.flatMap((carrier) => {
    const route = carrierRoute(carrier, scene)
    if (!route) return []
    const progress = Math.max(0, Math.min(1, carrierProgress ?? carrier.roadProgress))
    return [{
      carrier,
      offsetX: 0,
      position: interpolatePolyline(scene.mainRoad.points, progress),
      progress,
      route,
    }]
  })
  const groups = new Map<string, CarrierLayout[]>()
  for (const layout of baseLayouts) {
    const key = `${Math.round(layout.position.x)}:${Math.round(layout.position.y)}`
    const group = groups.get(key) ?? []
    group.push(layout)
    groups.set(key, group)
  }

  return [...groups.values()].flatMap((group) => {
    if (group.length < 2) return group
    return group.map((layout, index) => {
      const slot = index - (group.length - 1) / 2
      const spacing = 150
      return {
        ...layout,
        offsetX: Math.max(90, Math.min(scene.viewport.width - 90, layout.position.x + slot * spacing)) - layout.position.x,
      }
    })
  })
}

function carrierCueCount(carrier: CityCarrierState): number {
  return carrier.cueCount
}

function carrierLabel(carrier: CityCarrierState): string {
  const label = carrier.label ?? carrier.id
  return carrierCueCount(carrier) > 1 && /^\d+\s+records?\b/i.test(label)
    ? '메시지 흐름 요약'
    : label
}

function barrierPosition(
  scene: CitySceneDefinition,
  routeId: string | undefined,
  checkpointId: string | undefined,
  nodeId: string | undefined,
): CityPoint | null {
  if (routeId) {
    const route = scene.routes.find((candidate) => candidate.id === routeId)
    const checkpoint = route?.checkpoints.find((candidate) => candidate.id === checkpointId)
      ?? route?.checkpoints.at(-1)
    if (checkpoint) return checkpoint.position
  }
  return nodeId ? scene.nodes.find((candidate) => candidate.id === nodeId)?.position ?? null : null
}
