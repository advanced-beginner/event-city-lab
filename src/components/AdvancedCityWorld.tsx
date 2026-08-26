import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import atlasUrl from '../assets/city/background/event-city-atlas.webp'
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
  cursor: number
  events: readonly ChapterSimulationEvent[]
  motionDurationMs?: number
  onInspect: (nodeId: string) => void
  pendingRerun: boolean
  preview?: CityScenePreview
  reducedMotion: boolean
  scene: CitySceneDefinition
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

export function AdvancedCityWorld({
  cursor,
  events,
  motionDurationMs = 0,
  onInspect,
  pendingRerun,
  preview = EMPTY_PREVIEW,
  reducedMotion,
  scene,
}: AdvancedCityWorldProps) {
  const world = useMemo(() => projectCityWorld(scene, events, cursor), [cursor, events, scene])
  const nodes = Object.values(world.nodes)
  const routes = Object.values(world.routes)
  const carriers = Object.values(world.carriers)
  const carrierLayouts = layoutCarriers(carriers, scene)
  const physicalFacilities = groupPhysicalFacilities(scene, nodes)
  const visibleRouteId = carrierLayouts[0]?.route.id
  const visibleRoutes = visibleRouteId ? routes.filter((route) => route.id === visibleRouteId) : []
  const showPreview = cursor < 0 && events.length === 0

  return (
    <CityWorld
      backgroundUrl={atlasUrl}
      className={`${styles.world} ${pendingRerun ? styles.pending : ''}`}
      imageClassName={styles.backdrop}
      viewBox={`0 0 ${scene.viewport.width} ${scene.viewport.height}`}
      preserveAspectRatio="xMidYMid meet"
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
        <marker id="advanced-signal-arrow-success" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#238a5b" /></marker>
        <marker id="advanced-signal-arrow-control" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#7656c9" /></marker>
        <marker id="advanced-signal-arrow-failed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#d84a5b" /></marker>
      </defs>

      <rect className={styles.wash} width={scene.viewport.width} height={scene.viewport.height} aria-hidden="true" />

      {scene.boundaries?.map((boundary) => {
        const transactionState = nodes.find((node) => node.kind === 'transaction')?.state ?? 'idle'
        const previewed = showPreview && boundary.nodeIds.some((nodeId) => preview.nodeIds.includes(nodeId))
        return (
          <g
            key={boundary.id}
            className={`${styles.transactionBoundary} ${styles[transactionState]} ${previewed ? styles.previewBoundary : ''}`}
            data-city-boundary={boundary.id}
            data-boundary-state={transactionState}
            aria-hidden="true"
          >
            <g className={styles.transactionBadge} transform="translate(755 82)" data-city-boundary-badge="true">
              <rect width="410" height="48" rx="12" />
              <circle cx="27" cy="24" r="13" />
              <text x="27" y="30" textAnchor="middle">TX</text>
              <text x="222" y="30" textAnchor="middle">{boundary.label}</text>
            </g>
          </g>
        )
      })}

      <g className={styles.routeLayer} aria-hidden="true">
        <g className={styles.mainRoadGuide} data-city-main-road={scene.mainRoad.id}>
          <path className={styles.mainRoadGuideHalo} d={scene.mainRoad.path} />
          <path className={styles.mainRoadGuideLine} d={scene.mainRoad.path} />
          <circle className={styles.mainRoadAnchor} cx={scene.mainRoad.points[0]?.x} cy={scene.mainRoad.points[0]?.y} r="12" />
          <circle className={styles.mainRoadAnchor} cx={scene.mainRoad.points.at(-1)?.x} cy={scene.mainRoad.points.at(-1)?.y} r="12" />
          <g className={styles.mainRoadEndpoint} transform="translate(498 862)">
            <rect width="126" height="36" rx="9" />
            <text x="63" y="24" textAnchor="middle">8시 · 출발</text>
          </g>
          <g className={styles.mainRoadEndpoint} transform="translate(1625 318)">
            <rect width="126" height="36" rx="9" />
            <text x="63" y="24" textAnchor="middle">2시 · 도착</text>
          </g>
        </g>
        {visibleRoutes.map((route) => (
          <CityRoute key={route.id} route={route} previewed={false} />
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
                nodeId={facility.representative.id}
                accessibleName={physicalFacilityAccessibleName(facility)}
                onInspect={onInspect}
                hitAreaPath={facility.hitAreaPath}
                hitAreaClassName={styles.hitArea}
                className={`${styles.facility} ${styles[facility.state]} ${facility.focused ? styles.focused : ''} ${showPreview && facility.nodes.some((node) => preview.nodeIds.includes(node.id)) ? styles.previewFacility : ''}`}
              >
                <FacilitySign facility={facility} />
              </CityFacility>
            </g>
          )
        })}
      </g>

      <g className={styles.carrierLayer} aria-label="이동 중인 메시지와 제어 티켓">
        {carrierLayouts.map((layout) => (
          <CityCarrier
            key={layout.carrier.id}
            {...layout}
            mainRoadPath={scene.mainRoad.path}
            motionDurationMs={reducedMotion ? 0 : motionDurationMs}
          />
        ))}
      </g>

      {world.signal && (
        <SignalOverlay
          from={world.nodes[world.signal.fromNodeId]?.position}
          to={world.nodes[world.signal.toNodeId]?.position}
          kind={world.signal.kind}
          label={world.signal.label}
          state={world.signal.state}
        />
      )}

      {world.barrier && <BarrierOverlay scene={scene} barrier={world.barrier} />}

      {pendingRerun && (
        <g className={styles.pendingLabel} transform="translate(50 52)" aria-hidden="true">
          <rect width="360" height="56" rx="12" />
          <text x="20" y="35">↻ 수정 대기 · 재실행 필요</text>
        </g>
      )}
    </CityWorld>
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

interface PhysicalFacility {
  definition: CityPhysicalFacilityDefinition
  focused: boolean
  hitAreaPath: string
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
        focused: facilityNodes.some((node) => node.focused),
        hitAreaPath: definition.hitAreaPath,
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
  return `${facility.label}, ${STATE_LABELS[facility.state]}${logicalStates}`
}

function visualStatePriority(state: CityVisualState): number {
  return ({ failed: 5, blocked: 4, active: 3, complete: 2, muted: 1, idle: 0 } as const)[state]
}

function FacilitySign({ facility }: { facility: PhysicalFacility }) {
  const width = Math.max(180, Math.min(270, facility.label.length * 14 + 66))
  const x = facility.position.x - width / 2
  const y = facility.position.y - 24
  return (
    <g className={styles.facilitySign} transform={`translate(${x} ${y})`}>
      <rect width={width} height="48" rx="10" />
      <circle cx="22" cy="24" r="8" data-state={facility.state} />
      <text x="40" y="20">{facility.label}</text>
      <text x="40" y="37">{STATE_LABELS[facility.state]}</text>
      {facility.nodes.length > 1 && facility.nodes.length <= 3 && (
        <g className={styles.logicalBadges} transform={`translate(${width / 2} 56)`}>
          {facility.nodes.map((node, index) => {
            const badgeWidth = Math.max(58, Math.min(104, node.label.length * 10 + 30))
            const totalWidth = facility.nodes.reduce(
              (sum, candidate) => sum + Math.max(58, Math.min(104, candidate.label.length * 10 + 30)) + 6,
              -6,
            )
            const precedingWidth = facility.nodes.slice(0, index).reduce(
              (sum, candidate) => sum + Math.max(58, Math.min(104, candidate.label.length * 10 + 30)) + 6,
              0,
            )
            return (
              <g key={node.id} transform={`translate(${-totalWidth / 2 + precedingWidth} 0)`} data-logical-node={node.id} data-logical-state={node.state}>
                <rect width={badgeWidth} height="30" rx="8" />
                <text x={badgeWidth / 2} y="20" textAnchor="middle">{node.label} · {node.badge ?? STATE_LABELS[node.state]}</text>
              </g>
            )
          })}
        </g>
      )}
      {facility.nodes.length > 3 && (
        <g className={styles.logicalSummary} transform={`translate(${width / 2 - 96} 56)`}>
          <rect width="192" height="30" rx="8" />
          <text x="96" y="20" textAnchor="middle">
            {facility.nodes.length}개 논리 역할 · {facility.nodes.filter((node) => node.state === 'active').length} 활성
          </text>
        </g>
      )}
    </g>
  )
}

function CityCarrier({
  carrier,
  mainRoadPath,
  motionDurationMs,
  offsetX,
  position,
  progress,
  route,
}: CarrierLayout & { mainRoadPath: string; motionDurationMs: number }) {
  const label = carrier.label ?? carrier.id
  const isTicket = carrier.kind === 'offset-ticket'
  const motionSerial = useRef(0)
  const previousMotion = useRef({ progress })
  const targetKey = `${progress}:${motionDurationMs}`
  const previousTargetKey = useRef(targetKey)
  const [motion, setMotion] = useState<CarrierMotion | null>(() => (
    motionDurationMs > 0 && progress > 0.001
      ? {
          durationMs: distanceScaledDuration(motionDurationMs, 0, progress),
          fromProgress: 0,
          key: 0,
          path: mainRoadPath,
          toProgress: progress,
        }
      : null
  ))

  useLayoutEffect(() => {
    if (previousTargetKey.current === targetKey) return
    const previous = previousMotion.current
    const fromProgress = previous.progress
    previousMotion.current = { progress }
    previousTargetKey.current = targetKey
    if (motionDurationMs <= 0 || Math.abs(progress - fromProgress) <= 0.001) {
      setMotion(null)
      return
    }
    motionSerial.current += 1
    setMotion({
      durationMs: distanceScaledDuration(motionDurationMs, fromProgress, progress),
      fromProgress,
      key: motionSerial.current,
      path: mainRoadPath,
      toProgress: progress,
    })
  }, [mainRoadPath, motionDurationMs, progress, targetKey])

  useEffect(() => {
    if (!motion) return
    const timeout = window.setTimeout(() => setMotion(null), motion.durationMs)
    return () => window.clearTimeout(timeout)
  }, [motion])

  return (
    <g
      transform={motion
        ? offsetX === 0 ? undefined : `translate(${offsetX} 0)`
        : `translate(${position.x + offsetX} ${position.y})`}
      className={`${styles.carrier} ${styles[carrier.state ?? 'active']} ${styles[`carrier_${carrier.kind}`]}`}
      data-city-carrier={carrier.id}
      data-carrier-kind={carrier.kind}
      data-carrier-batch-size={carrier.batchSize}
      data-carrier-direction="forward"
      data-carrier-progress={progress.toFixed(3)}
      data-carrier-route={route.id}
      data-motion-mode={motion ? 'road-path' : 'instant'}
    >
      {motion && (
        <animateMotion
          key={motion.key}
          path={motion.path}
          keyPoints={`${motion.fromProgress};${motion.toProgress}`}
          keyTimes="0;1"
          calcMode="linear"
          dur={`${motion.durationMs}ms`}
          fill="freeze"
        />
      )}
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

interface CarrierMotion {
  durationMs: number
  fromProgress: number
  key: number
  path: string
  toProgress: number
}

function distanceScaledDuration(
  baseDurationMs: number,
  fromProgress: number,
  toProgress: number,
): number {
  if (baseDurationMs <= 0) return 0
  return Math.max(16, Math.round(baseDurationMs * Math.abs(toProgress - fromProgress)))
}

function SignalOverlay({
  from,
  kind,
  label,
  state,
  to,
}: {
  from: CityPoint | undefined
  kind: string
  label: string
  state: CityVisualState
  to: CityPoint | undefined
}) {
  if (!from || !to) return null
  const control = kind === 'metadata' || kind === 'assignment' || kind === 'revocation' || kind.startsWith('tx-')
  const marker = state === 'failed' || state === 'blocked'
    ? 'failed'
    : control
      ? 'control'
      : 'success'
  const midpointX = Math.max(420, Math.min(1500, (from.x + to.x) / 2))
  const statusLabel = state === 'failed' || state === 'blocked'
    ? `! ${label}`
    : control
      ? `↺ ${label}`
      : `✓ ${label}`
  return (
    <g className={`${styles.signal} ${control ? styles.controlSignal : styles.successSignal} ${styles[state]}`} data-city-signal={kind}>
      <g className={styles.signalPulse} transform={`translate(${to.x} ${to.y})`} data-signal-marker={marker}>
        <circle r="22" />
        <circle r="9" />
      </g>
      <g className={styles.signalStatus} transform={`translate(${midpointX - 105} 150)`} data-city-signal-label="true">
        <rect width="210" height="40" rx="10" />
        <text x="105" y="26" textAnchor="middle">{statusLabel}</text>
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
  const labelOffset = barrierLabelOffset(scene, position)
  return (
    <g className={`${styles.barrier} ${barrier.state === 'closed' ? styles.barrierClosed : styles.barrierOpen}`} transform={`translate(${position.x} ${position.y})`} data-city-barrier={barrier.state}>
      <path d="M-44 0H44M-34-18 34 18M-34 18 34-18" />
      <g transform={`translate(${labelOffset.x} ${labelOffset.y})`}><rect width="180" height="34" rx="8" /><text x="90" y="23" textAnchor="middle">{barrier.label}</text></g>
    </g>
  )
}

function barrierLabelOffset(scene: CitySceneDefinition, position: CityPoint): CityPoint {
  const horizontalRatio = position.x / scene.viewport.width
  if (horizontalRatio < 0.45) return { x: 56, y: 50 }
  if (horizontalRatio < 0.6) return { x: 56, y: -102 }
  return { x: -236, y: -102 }
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
): CarrierLayout[] {
  const baseLayouts = carriers.flatMap((carrier) => {
    const route = carrierRoute(carrier, scene)
    if (!route) return []
    const progress = carrier.roadProgress
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
