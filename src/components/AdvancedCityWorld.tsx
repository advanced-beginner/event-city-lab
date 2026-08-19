import { useMemo } from 'react'

import atlasUrl from '../assets/city/background/event-city-atlas.webp'
import { projectCityWorld } from '../city/projection'
import type {
  CityCarrierState,
  CityNodeState,
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
            <path d={boundary.path} />
            <g transform="translate(730 105)"><rect width="470" height="42" rx="9" /><text x="235" y="27" textAnchor="middle">{boundary.label}</text></g>
          </g>
        )
      })}

      <g className={styles.routeLayer} aria-hidden="true">
        {routes.map((route) => (
          <CityRoute key={route.id} route={route} previewed={showPreview && preview.routeIds.includes(route.id)} />
        ))}
      </g>

      <g className={styles.facilityLayer}>
        {nodes.map((node) => (
          <CityFacility
            key={node.id}
            nodeId={node.id}
            accessibleName={`${node.ariaLabel ?? node.label}, ${STATE_LABELS[node.state]}${node.badge ? `, ${node.badge}` : ''}`}
            onInspect={onInspect}
            hitAreaPath={node.hitAreaPath}
            hitAreaClassName={styles.hitArea}
            className={`${styles.facility} ${styles[node.state]} ${node.focused ? styles.focused : ''} ${showPreview && preview.nodeIds.includes(node.id) ? styles.previewFacility : ''}`}
          >
            <FacilitySign node={node} />
          </CityFacility>
        ))}
      </g>

      <g className={styles.carrierLayer} aria-label="이동 중인 메시지와 제어 티켓">
        {carrierLayouts.map(({ carrier, position }) => (
          <CityCarrier key={carrier.id} carrier={carrier} position={position} />
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

function FacilitySign({ node }: { node: CityNodeState }) {
  const width = Math.max(152, Math.min(246, node.label.length * 14 + 66))
  const x = node.position.x - width / 2
  const y = node.position.y - 24
  return (
    <g className={styles.facilitySign} transform={`translate(${x} ${y})`}>
      <rect width={width} height="48" rx="10" />
      <circle cx="22" cy="24" r="8" data-state={node.state} />
      <text x="40" y="20">{node.label}</text>
      <text x="40" y="37">{node.badge ?? STATE_LABELS[node.state]}</text>
    </g>
  )
}

function CityCarrier({ carrier, position }: { carrier: CityCarrierState; position: CityPoint }) {
  const label = carrier.label ?? carrier.id
  const isTicket = carrier.kind === 'offset-ticket'
  return (
    <g
      transform={`translate(${position.x} ${position.y})`}
      className={`${styles.carrier} ${styles[carrier.state ?? 'active']} ${styles[`carrier_${carrier.kind}`]}`}
      data-city-carrier={carrier.id}
      data-carrier-kind={carrier.kind}
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
      <g className={styles.cargoLabel} transform="translate(-72 20)">
        <rect width="144" height="28" rx="7" />
        <text x="72" y="19" textAnchor="middle">{label}</text>
      </g>
    </g>
  )
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
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy) || 1
  const startInset = Math.min(88, distance * 0.18)
  const endInset = Math.min(112, distance * 0.22)
  const start = { x: from.x + (dx / distance) * startInset, y: from.y + (dy / distance) * startInset }
  const end = { x: to.x - (dx / distance) * endInset, y: to.y - (dy / distance) * endInset }
  const midpoint = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 90 }
  return (
    <g className={`${styles.signal} ${control ? styles.controlSignal : styles.successSignal} ${styles[state]}`} data-city-signal={kind}>
      <path d={`M${start.x} ${start.y} Q${midpoint.x} ${midpoint.y} ${end.x} ${end.y}`} markerEnd={`url(#advanced-signal-arrow-${marker})`} />
      <g transform={`translate(${midpoint.x - 80} ${midpoint.y - 24})`}>
        <rect width="160" height="38" rx="9" />
        <text x="80" y="25" textAnchor="middle">{label}</text>
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
      <g transform="translate(-90 -58)"><rect width="180" height="34" rx="8" /><text x="90" y="23" textAnchor="middle">{barrier.label}</text></g>
    </g>
  )
}

function carrierPosition(carrier: CityCarrierState, scene: CitySceneDefinition): CityPoint {
  const route = scene.routes.find((candidate) => candidate.id === carrier.routeId)
  if (!route) return { x: 0, y: 0 }
  const checkpoint = carrier.checkpointId
    ? route.checkpoints.find((candidate) => candidate.id === carrier.checkpointId)
    : undefined
  if (checkpoint) return checkpoint.position
  return interpolateRoute(route, carrier.progress ?? 0)
}

function layoutCarriers(
  carriers: readonly CityCarrierState[],
  scene: CitySceneDefinition,
): Array<{ carrier: CityCarrierState; position: CityPoint }> {
  const baseLayouts = carriers.map((carrier) => ({ carrier, position: carrierPosition(carrier, scene) }))
  const groups = new Map<string, Array<{ carrier: CityCarrierState; position: CityPoint }>>()
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
        carrier: layout.carrier,
        position: {
          x: Math.max(90, Math.min(scene.viewport.width - 90, layout.position.x + slot * spacing)),
          y: layout.position.y,
        },
      }
    })
  })
}

function interpolateRoute(route: CityRouteDefinition, progress: number): CityPoint {
  const first = route.checkpoints[0]?.position ?? { x: 0, y: 0 }
  const last = route.checkpoints.at(-1)?.position ?? first
  const bounded = Math.max(0, Math.min(1, progress))
  return {
    x: first.x + (last.x - first.x) * bounded,
    y: first.y + (last.y - first.y) * bounded,
  }
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
