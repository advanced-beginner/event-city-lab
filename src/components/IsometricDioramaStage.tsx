import { useMemo, type CSSProperties } from 'react'

import { getAdvancedCityCamera, type AdvancedCityViewMode } from '../city/camera'
import {
  createDioramaBase,
  createIsoPostalVan,
  createIsoPrism,
  pointsToPolygon,
  pointsToSvgPath,
  shadeIsoFaces,
} from '../city/isometric'
import { buildCarrierTransitions, projectCityWorld } from '../city/projection'
import {
  clampProgress,
  headingAtPolylineProgress,
  interpolatePolyline,
} from '../city/routeGeometry'
import type { CityScenePreview } from '../city/chapterScenes'
import type {
  CityBuildingArchetype,
  CityCarrierKind,
  CityCarrierState,
  CityCuedEvent,
  CityNodeState,
  CityPhysicalFacilityDefinition,
  CityPoint,
  CityRouteState,
  CitySceneDefinition,
  CityVisualState,
  CityWorldState,
} from '../city/types'

import { CityFacility } from './CityFacility'
import styles from './IsometricDioramaStage.module.css'

export interface IsometricDioramaStageProps {
  attempt?: number
  carrierProgress?: number
  cursor: number
  events: readonly CityCuedEvent[]
  exploded?: boolean
  focusedSetting?: string | null
  isPlaying?: boolean
  onInspect: (nodeId: string) => void
  onToggleExploded?: () => void
  onViewModeChange?: (mode: AdvancedCityViewMode) => void
  pendingRerun: boolean
  preview?: CityScenePreview
  reducedMotion: boolean
  runStatus?: 'failed' | 'succeeded'
  scene: CitySceneDefinition
  showChapterOneAckBubble?: boolean
  viewMode?: AdvancedCityViewMode
  viewportSize?: { width: number; height: number }
}

interface PhysicalFacilityModel {
  definition: CityPhysicalFacilityDefinition
  focused: boolean
  nodes: readonly CityNodeState[]
  state: CityVisualState
  depthOrder: number
}

interface DisplayCarrierModel {
  carrier: CityCarrierState
  position: CityPoint
  heading: CityCarrierState['heading']
  route: CityRouteState
  progress: number
}

interface CityHudItem {
  icon: string
  key: string
  label: string
  state: CityVisualState
}

const STATE_LABELS: Record<CityVisualState, string> = {
  idle: '대기',
  active: '처리 중',
  blocked: '차단',
  failed: '실패',
  complete: '완료',
  muted: '비활성',
}

const ARCHETYPE_COLORS: Record<CityBuildingArchetype, string> = {
  warehouse: '#38bdf8',
  gate: '#a78bfa',
  hub: '#3b82f6',
  tower: '#6366f1',
  loop: '#f59e0b',
  vault: '#f43f5e',
  checkpoint: '#14b8a6',
  factory: '#10b981',
}

const EMPTY_PREVIEW: CityScenePreview = { nodeIds: [], routeIds: [] }

export function IsometricDioramaStage({
  attempt,
  carrierProgress,
  cursor,
  events,
  exploded = false,
  focusedSetting = null,
  isPlaying = false,
  onInspect,
  onToggleExploded,
  onViewModeChange,
  pendingRerun,
  preview = EMPTY_PREVIEW,
  reducedMotion,
  runStatus,
  scene,
  showChapterOneAckBubble = false,
  viewMode = 'focus',
  viewportSize,
}: IsometricDioramaStageProps) {
  const world = useMemo(() => projectCityWorld(scene, events, cursor), [cursor, events, scene])
  const prevWorld = useMemo(
    () => (cursor >= 0 ? projectCityWorld(scene, events, cursor - 1) : world),
    [cursor, events, scene, world],
  )

  const nodes = Object.values(world.nodes)
  const routes = Object.values(world.routes)
  const physicalFacilities = useMemo(() => buildFacilityModels(scene, nodes), [nodes, scene])
  const camera = useMemo(
    () => getAdvancedCityCamera(scene, physicalFacilities.map((f) => f.definition), viewMode, viewportSize),
    [physicalFacilities, scene, viewMode, viewportSize],
  )
  const dioramaBase = useMemo(() => createDioramaBase(scene.gridBounds, 44), [scene.gridBounds])

  const displayCarriers = useMemo(
    () => resolveDisplayCarriers(scene, prevWorld, world, carrierProgress),
    [carrierProgress, prevWorld, scene, world],
  )

  const showPreview = cursor < 0 && events.length === 0
  const hudItems = cityHudItems(scene, world, pendingRerun)
  const motionActive = isPlaying && !runStatus && !reducedMotion
  const titleId = `diorama-title-${scene.id}`
  const descId = `diorama-desc-${scene.id}`

  return (
    <div
      className={`${styles.stageFrame} ${pendingRerun ? styles.pending : ''} ${reducedMotion ? styles.reduced : ''}`}
      data-advanced-city
      data-diorama-stage
      data-diorama-exploded={exploded ? 'true' : 'false'}
      data-city-view-mode={viewMode}
      data-city-run-status={runStatus ?? 'running'}
      data-city-playing={isPlaying ? 'true' : 'false'}
      data-city-motion-active={motionActive ? 'true' : 'false'}
    >
      <div className={styles.stageTopBar}>
        <div className={styles.toolbarGroup}>
          <span className={styles.districtTag}>
            <span className={styles.liveDot} aria-hidden="true" />
            {scene.label}
          </span>
          {onViewModeChange && (
            <div className={styles.segmentedControl} role="group" aria-label="도시 보기">
              <button
                type="button"
                aria-pressed={viewMode === 'focus'}
                onClick={() => onViewModeChange('focus')}
              >
                핵심 도로
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'overview'}
                onClick={() => onViewModeChange('overview')}
              >
                전체 지도
              </button>
            </div>
          )}
        </div>

        <div className={styles.toolbarGroup}>
          {onToggleExploded && (
            <button
              type="button"
              className={styles.explodeButton}
              aria-pressed={exploded}
              onClick={onToggleExploded}
            >
              {exploded ? '조립 뷰' : '분해 뷰'}
            </button>
          )}
          <div className={styles.legend} aria-hidden="true">
            <span><i className={styles.legendCyan} />처리·주행</span>
            <span><i className={styles.legendViolet} />예측·설정</span>
            <span><i className={styles.legendRed} />실패·차단</span>
            <span><i className={styles.legendGreen} />완료·ACK</span>
          </div>
        </div>
      </div>

      {hudItems.length > 0 && (
        <div className={styles.cityHud} data-city-hud>
          {hudItems.map((item) => (
            <div key={item.key} className={`${styles.hudChip} ${styles[`hud_${item.state}`] ?? ''}`} data-city-hud-item={item.key}>
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
      )}

      <div className={styles.canvasWrapper}>
        <svg
          key={scene.id}
          className={`${styles.worldSvg} ${reducedMotion ? 'city-world-reduced-motion' : ''}`}
          viewBox={camera.viewBox}
          preserveAspectRatio={camera.preserveAspectRatio}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          data-city-world
          data-reduced-motion={reducedMotion ? 'true' : 'false'}
        >
          <title id={titleId}>{scene.label} Kafka 디오라마</title>
          <desc id={descId}>
            입체 아이소메트릭 우편 물류 도시 위에서 노란 우편 배송 차량이 출발센터, 검사소, 파티션, 처리공장까지 연결된 도로를 주행하고 광섬유 신호로 결과를 회신합니다.
          </desc>

          <defs>
            <filter id="iso-soft-shadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#1e293b" floodOpacity="0.22" />
            </filter>
            <filter id="iso-glow-cyan" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#22d3ee" floodOpacity="0.7" />
            </filter>
            <filter id="iso-glow-violet" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#a78bfa" floodOpacity="0.8" />
            </filter>
            <linearGradient id="iso-deck-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#263349" />
              <stop offset="100%" stopColor="#162032" />
            </linearGradient>
            <marker id="iso-signal-arrow-success" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 1 L9 5 L0 9 Z" fill="#34d399" />
            </marker>
            <marker id="iso-signal-arrow-control" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 1 L9 5 L0 9 Z" fill="#a78bfa" />
            </marker>
            <marker id="iso-signal-arrow-failed" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 1 L9 5 L0 9 Z" fill="#fb7185" />
            </marker>
          </defs>

          {/* 1. Diorama Cutaway Base Slab */}
          <g className={styles.cutawayBase} aria-hidden="true">
            <polygon className={styles.baseShadow} points={dioramaBase.dropShadow} />
            <polygon className={styles.baseSubLeft} points={dioramaBase.leftSubStratum} />
            <polygon className={styles.baseSubRight} points={dioramaBase.rightSubStratum} />
            <polygon className={styles.baseLeft} points={dioramaBase.leftCutaway} />
            <polygon className={styles.baseRight} points={dioramaBase.rightCutaway} />
            <polygon className={styles.baseDeck} points={dioramaBase.topDeck} fill="url(#iso-deck-grad)" />
            <path className={styles.baseRimHighlight} d={dioramaBase.deckRimPath} />
            <g className={styles.gridLines}>
              {dioramaBase.gridPaths.map((d, index) => (
                <path key={index} d={d} />
              ))}
            </g>
          </g>

          {/* 2. Isometric Road & Turnout Network */}
          <g className={styles.roadLayer} aria-hidden="true">
            {routes.map((route) => {
              const previewed = showPreview && preview.routeIds.includes(route.id)
              return <DioramaRoute key={route.id} route={route} previewed={previewed} />
            })}
          </g>

          {/* 3. Fiber-Optic Signal Path */}
          {world.signal && (
            <FiberSignalOverlay
              scene={scene}
              signal={world.signal}
              showChapterOneAckBubble={showChapterOneAckBubble}
              onInspect={onInspect}
            />
          )}

          {/* 4. Isometric 3D Facility Buildings (Sorted back-to-front by isometric depth) */}
          <g className={styles.facilityLayer}>
            {physicalFacilities.map((facility, index) => {
              const isSettingFocused = Boolean(
                focusedSetting && (
                  (focusedSetting === 'serializer' && facility.definition.id === 'serializer')
                  || (focusedSetting === 'acks' && facility.definition.id === 'broker')
                ),
              )
              const isPreviewed = showPreview && facility.nodes.some((node) => preview.nodeIds.includes(node.id))
              return (
                <g
                  key={facility.definition.id}
                  data-city-facility-slot={facility.definition.id}
                  className={styles.facilityExtrude}
                  style={{ '--stagger-index': index } as CSSProperties}
                >
                  <CityFacility
                    nodeId={facility.definition.id}
                    accessibleName={facilityAccessibleName(facility)}
                    onInspect={onInspect}
                    hitAreaPath={facility.definition.hitAreaPath}
                    hitAreaClassName={styles.hitArea}
                    className={`${styles.facility} ${styles[`state_${facility.state}`] ?? ''} ${facility.focused ? styles.focused : ''} ${isSettingFocused ? styles.settingFocused : ''} ${isPreviewed ? styles.previewFacility : ''}`}
                  >
                    <IsometricFacilityBuilding
                      facility={facility}
                      exploded={exploded}
                      previewNodeIds={showPreview ? preview.nodeIds : []}
                    />
                  </CityFacility>
                </g>
              )
            })}
          </g>

          {/* 5. Physical Road Barrier */}
          {world.barrier && <IsometricBarrier scene={scene} barrier={world.barrier} />}

          {/* 6. 4-Way Isometric Vector Postal Vans */}
          <g className={styles.carrierLayer} aria-label="메시지 우편 차량">
            {displayCarriers.map((item) => (
              <IsometricPostalVan
                key={item.carrier.id}
                model={item}
                {...(attempt !== undefined ? { attempt } : {})}
                chapterId={scene.chapterId}
                overallProgress={item.carrier.id === 'vehicle' ? (carrierProgress ?? item.progress) : item.progress}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}

function DioramaRoute({ route, previewed }: { route: CityRouteState; previewed: boolean }) {
  const isConduit = route.kind === 'return' || route.kind === 'transaction' || route.kind === 'control'
  const isActiveFlow = route.state === 'active' || previewed

  if (isConduit) {
    return (
      <g
        data-city-route={route.id}
        data-route-kind={route.kind}
        data-route-state={route.state}
        className={`${styles.conduitRoute} ${styles[`route_${route.kind}`]} ${styles[`route_${route.state}`]} ${route.disabled ? styles.routeDisabled : ''} ${previewed ? styles.previewRoute : ''}`}
      >
        <path className={styles.conduitHalo} d={route.path} />
        <path className={`${styles.conduitLine} ${isActiveFlow ? styles.flowPulse : ''}`} d={route.path} />
      </g>
    )
  }

  return (
    <g
      data-city-route={route.id}
      data-route-kind={route.kind}
      data-route-state={route.state}
      className={`${styles.streetRoute} ${styles[`route_${route.kind}`]} ${styles[`route_${route.state}`]} ${route.disabled ? styles.routeDisabled : ''} ${previewed ? styles.previewRoute : ''}`}
    >
      <path className={styles.roadCurb} d={route.path} />
      <path className={styles.roadAsphalt} d={route.path} />
      <path className={styles.roadCenterLine} d={route.path} />
      {(route.state !== 'idle' || previewed) && (
        <path className={`${styles.roadStatusBeam} ${isActiveFlow ? styles.flowPulse : ''}`} d={route.path} />
      )}
    </g>
  )
}

function IsometricFacilityBuilding({
  facility,
  exploded,
  previewNodeIds,
}: {
  facility: PhysicalFacilityModel
  exploded: boolean
  previewNodeIds: readonly string[]
}) {
  const { definition, nodes, state } = facility
  const { u, v } = definition.grid
  const { u: sizeU, v: sizeV, height } = definition.footprint

  const baseColor = facilityColorForState(definition.archetype, state)
  const plinthColors = shadeIsoFaces('#475569')
  const bodyColors = shadeIsoFaces(baseColor)
  const roofColors = shadeIsoFaces('#e2e8f0')

  const plinth = createIsoPrism(u, v, sizeU + 0.14, sizeV + 0.14, 12, 0)
  const bodyHeight = Math.max(24, height - 18)
  const body = createIsoPrism(u, v, sizeU, sizeV, bodyHeight, 12)
  const roof = createIsoPrism(u, v, sizeU + 0.06, sizeV + 0.06, 10, 12 + bodyHeight)

  const explodeBodyY = exploded ? -18 : 0
  const explodeRoofY = exploded ? -44 : 0

  const signY = body.topCenter.y + explodeRoofY - 34
  const badgeY = definition.position.y + 30
  const stateLabel = STATE_LABELS[state]
  const signText = `${definition.label} · ${definition.koreanLabel}`
  const signWidth = Math.max(156, Math.min(256, signText.length * 7.2 + 76))

  return (
    <g className={styles.buildingAssembly}>
      {/* Ground Contact Shadow */}
      <polygon className={styles.buildingShadow} points={plinth.shadowFace} />

      {/* Layer 1: Foundation Plinth */}
      <g className={styles.layerPlinth}>
        <polygon points={plinth.leftFace} fill={plinthColors.left} stroke="#0f172a" strokeWidth="1.5" />
        <polygon points={plinth.rightFace} fill={plinthColors.right} stroke="#0f172a" strokeWidth="1.5" />
        <polygon points={plinth.topFace} fill={plinthColors.top} stroke="#64748b" strokeWidth="1" />
      </g>

      {/* Internal Core Plate (Revealed cleanly when Exploded View is active) */}
      {exploded && (
        <g className={styles.internalCore} aria-hidden="true">
          <polygon
            points={createIsoPrism(u, v, sizeU * 0.72, sizeV * 0.72, 8, 13).topFace}
            fill="#0ea5e9"
            fillOpacity="0.45"
            stroke="#38bdf8"
            strokeWidth="1.5"
          />
          <line
            x1={plinth.topCenter.x}
            y1={plinth.topCenter.y}
            x2={plinth.topCenter.x}
            y2={plinth.topCenter.y + explodeRoofY}
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        </g>
      )}

      {/* Layer 2: Main Building Block */}
      <g className={styles.layerBody} transform={`translate(0 ${explodeBodyY})`}>
        <polygon points={body.leftFace} fill={bodyColors.left} stroke="#0f172a" strokeWidth="1.6" />
        <polygon points={body.rightFace} fill={bodyColors.right} stroke="#0f172a" strokeWidth="1.6" />
        <polygon points={body.topFace} fill={bodyColors.top} stroke="#0f172a" strokeWidth="1.4" />
        <path d={body.topBevelPath} fill="none" stroke={bodyColors.bevel} strokeWidth="1.8" opacity="0.8" />
        <BuildingFacadeDetails u={u} v={v} sizeU={sizeU} sizeV={sizeV} bodyHeight={bodyHeight} archetype={definition.archetype} />
      </g>

      {/* Layer 3: Roof Cap & Archetype Props */}
      <g className={styles.layerRoof} transform={`translate(0 ${explodeRoofY})`}>
        <polygon points={roof.leftFace} fill={roofColors.left} stroke="#1e293b" strokeWidth="1.5" />
        <polygon points={roof.rightFace} fill={roofColors.right} stroke="#1e293b" strokeWidth="1.5" />
        <polygon points={roof.topFace} fill={roofColors.top} stroke="#1e293b" strokeWidth="1.4" />
        <path d={roof.topBevelPath} fill="none" stroke="#ffffff" strokeWidth="1.8" opacity="0.85" />
        <ArchetypeRoofEquipment
          archetype={definition.archetype}
          topCenter={roof.topCenter}
          state={state}
        />
      </g>

      {/* State Ring & Hover Outline */}
      <path className={styles.buildingFocusRing} d={definition.hitAreaPath} />

      {/* Crisp Isometric Facility Nameplate */}
      <g className={styles.facilitySign} transform={`translate(${body.topCenter.x - signWidth / 2} ${signY})`}>
        <rect width={signWidth} height="34" rx="8" />
        <circle cx="15" cy="17" r="5" className={styles.stateLamp} data-state={state} />
        <text x="27" y="15" className={styles.signTitle}>{definition.label} · {definition.koreanLabel}</text>
        <text x="27" y="28" className={styles.signStatus}>{stateLabel}</text>
      </g>

      {/* Serializer Error Sign (Chapter 1 explicit failure callout) */}
      {definition.id === 'serializer' && state === 'failed' && (
        <g className={styles.errorCallout} transform={`translate(${body.topCenter.x - 102} ${signY - 34})`}>
          <rect width="204" height="28" rx="7" />
          <text x="102" y="18" textAnchor="middle">2 · OrderEvent ≠ StringSerializer</text>
        </g>
      )}

      {/* Logical Sub-Node Badges when complex holds multiple Kafka roles */}
      {nodes.length > 1 && (
        <g className={styles.logicalTray} transform={`translate(${definition.position.x} ${badgeY})`}>
          {nodes.length <= 3 ? (
            nodes.map((node, index) => {
              const text = logicalBadgeText(node)
              const width = Math.max(58, Math.min(118, text.length * 6.8 + 18))
              const totalWidth = nodes.reduce((acc, item) => acc + Math.max(58, Math.min(118, logicalBadgeText(item).length * 6.8 + 18)) + 5, -5)
              const offsetX = nodes.slice(0, index).reduce((acc, item) => acc + Math.max(58, Math.min(118, logicalBadgeText(item).length * 6.8 + 18)) + 5, 0)
              const previewed = previewNodeIds.includes(node.id)
              return (
                <g
                  key={node.id}
                  transform={`translate(${-totalWidth / 2 + offsetX} 0)`}
                  className={styles.logicalPill}
                  data-logical-node={node.id}
                  data-logical-state={node.state}
                  data-logical-preview={previewed ? 'true' : 'false'}
                >
                  <rect width={width} height="24" rx="6" />
                  <text x={width / 2} y="15.5" textAnchor="middle">{text}</text>
                </g>
              )
            })
          ) : (
            <g
              className={styles.logicalSummaryPill}
              transform="translate(-94 0)"
              data-logical-preview={nodes.some((n) => previewNodeIds.includes(n.id)) ? 'true' : 'false'}
            >
              <rect width="188" height="24" rx="6" />
              <text x="94" y="15.5" textAnchor="middle">
                {logicalGroupSummary(nodes, previewNodeIds)}
              </text>
            </g>
          )}
        </g>
      )}
    </g>
  )
}

function BuildingFacadeDetails({
  u,
  v,
  sizeU,
  sizeV,
  bodyHeight,
  archetype,
}: {
  u: number
  v: number
  sizeU: number
  sizeV: number
  bodyHeight: number
  archetype: CityBuildingArchetype
}) {
  const bayPrism = createIsoPrism(u - sizeU * 0.14, v + sizeV * 0.44, sizeU * 0.36, 0.12, Math.min(18, bodyHeight * 0.45), 12)
  const windowPrism = createIsoPrism(u - sizeU * 0.44, v - sizeV * 0.05, 0.08, sizeV * 0.44, 10, 12 + bodyHeight * 0.46)

  return (
    <g aria-hidden="true" opacity="0.88">
      <polygon points={bayPrism.rightFace} fill="#0f172a" opacity="0.72" />
      <polygon points={windowPrism.leftFace} fill={archetype === 'vault' ? '#fda4af' : '#bae6fd'} opacity="0.65" />
    </g>
  )
}

function ArchetypeRoofEquipment({
  archetype,
  topCenter,
  state,
}: {
  archetype: CityBuildingArchetype
  topCenter: CityPoint
  state: CityVisualState
}) {
  const { x, y } = topCenter
  const lampColor = state === 'failed' ? '#f43f5e' : state === 'blocked' ? '#f59e0b' : state === 'complete' ? '#10b981' : state === 'active' ? '#06b6d4' : '#94a3b8'

  switch (archetype) {
    case 'tower':
      return (
        <g aria-hidden="true">
          <line x1={x} y1={y - 4} x2={x} y2={y - 30} stroke="#334155" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx={x} cy={y - 22} rx="12" ry="6" fill="#cbd5e1" stroke="#334155" strokeWidth="1.5" />
          <circle cx={x} cy={y - 32} r="4.5" fill={lampColor} stroke="#0f172a" strokeWidth="1.2" />
        </g>
      )
    case 'gate':
      return (
        <g aria-hidden="true">
          <path d={`M${x - 16} ${y - 3} L${x} ${y - 19} L${x + 16} ${y - 3}`} fill="none" stroke="#4c1d95" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={x} cy={y - 19} r="5" fill={lampColor} stroke="#1e1b4b" strokeWidth="1.5" />
        </g>
      )
    case 'loop':
      return (
        <g aria-hidden="true">
          <ellipse cx={x} cy={y - 5} rx="16" ry="8" fill="none" stroke="#d97706" strokeWidth="3" strokeDasharray="6 4" />
          <circle cx={x} cy={y - 5} r="4" fill={lampColor} />
        </g>
      )
    case 'vault':
      return (
        <g aria-hidden="true">
          <rect x={x - 12} y={y - 12} width="24" height="10" rx="3" fill="#9f1239" stroke="#4c0519" strokeWidth="1.2" />
          <circle cx={x} cy={y - 7} r="3.5" fill="#fecdd3" />
        </g>
      )
    case 'factory':
      return (
        <g aria-hidden="true">
          <rect x={x - 10} y={y - 20} width="7" height="16" rx="2" fill="#475569" stroke="#0f172a" strokeWidth="1.2" />
          <rect x={x + 4} y={y - 16} width="7" height="12" rx="2" fill="#475569" stroke="#0f172a" strokeWidth="1.2" />
          <circle cx={x - 6.5} cy={y - 22} r="3" fill={lampColor} />
        </g>
      )
    default:
      return (
        <g aria-hidden="true">
          <rect x={x - 14} y={y - 10} width="28" height="8" rx="3" fill="#334155" />
          <circle cx={x} cy={y - 6} r="3.5" fill={lampColor} />
        </g>
      )
  }
}

function IsometricPostalVan({
  model,
  attempt,
  chapterId,
  overallProgress,
}: {
  model: DisplayCarrierModel
  attempt?: number
  chapterId: number
  overallProgress: number
}) {
  const { carrier, position, heading, route } = model
  const isTicket = carrier.kind === 'offset-ticket'
  const palette = vehicleColorsForKind(carrier.kind)
  const van = useMemo(
    () => createIsoPostalVan(heading, palette.body, palette.cab, 0.96),
    [heading, palette.body, palette.cab],
  )
  const label = carrierDisplayLabel(carrier, chapterId, attempt)
  const badgeWidth = Math.max(112, Math.min(206, label.length * 7.2 + 24))

  return (
    <g
      transform={`translate(${position.x} ${position.y})`}
      className={`${styles.carrier} ${styles[`carrier_${carrier.kind}`]} ${styles[`carrierState_${carrier.state ?? 'active'}`] ?? ''}`}
      data-city-carrier={carrier.id}
      data-carrier-kind={carrier.kind}
      data-carrier-cue-count={carrier.cueCount}
      data-carrier-direction="forward"
      data-carrier-heading={heading}
      data-carrier-progress={overallProgress.toFixed(3)}
      data-carrier-route={route.id}
      data-motion-mode="external"
    >
      {isTicket ? (
        <g className={styles.offsetTicketPod}>
          <polygon points={van.shadowPolygon} fill="#0f172a" opacity="0.28" />
          <path d="M-22 -26 L0 -37 L22 -26 L22 -10 L0 1 L-22 -10 Z" fill="#0891b2" stroke="#083344" strokeWidth="1.6" />
          <path d="M-22 -26 L0 -15 L22 -26 L0 -37 Z" fill="#67e8f9" stroke="#083344" strokeWidth="1.3" />
          <text x="0" y="-12" textAnchor="middle" className={styles.ticketText}>OFFSET</text>
        </g>
      ) : (
        <g className={styles.isoVan}>
          <polygon points={van.shadowPolygon} fill="#020617" opacity="0.34" />
          {van.wheels.map((wheel, index) => (
            <ellipse key={index} cx={wheel.x} cy={wheel.y} rx="5.5" ry="4" fill="#1e293b" stroke="#020617" strokeWidth="1.2" />
          ))}
          {van.boxes.map((box) => (
            <g key={box.id}>
              <polygon points={box.geometry.leftFace} fill={box.palette.left} stroke={box.stroke} strokeWidth="1.3" />
              <polygon points={box.geometry.rightFace} fill={box.palette.right} stroke={box.stroke} strokeWidth="1.3" />
              <polygon points={box.geometry.topFace} fill={box.palette.top} stroke={box.stroke} strokeWidth="1.2" />
              <path d={box.geometry.topHighlightPath} fill="none" stroke={box.palette.bevel} strokeWidth="1.3" opacity="0.85" />
            </g>
          ))}
          <polygon points={van.windshieldPolygon} fill="#bae6fd" stroke="#0369a1" strokeWidth="1" opacity="0.92" />
          {(heading === 'sw' || heading === 'se') && van.headlights.map((light, index) => (
            <circle key={index} cx={light.x} cy={light.y} r="2.2" fill="#fef08a" />
          ))}
          {(heading === 'ne' || heading === 'nw') && van.taillights.map((light, index) => (
            <circle key={index} cx={light.x} cy={light.y} r="2" fill="#fb7185" />
          ))}
          <circle
            cx={van.roofBeacon.x}
            cy={van.roofBeacon.y}
            r="3"
            fill={carrier.state === 'failed' ? '#f43f5e' : '#22d3ee'}
            stroke="#0f172a"
            strokeWidth="1"
          />
        </g>
      )}

      {carrier.state === 'failed' && (
        <g className={styles.carrierAlert} transform="translate(26 -48)" aria-hidden="true">
          <circle r="13" />
          <text y="4.5" textAnchor="middle">!</text>
        </g>
      )}

      <g className={styles.cargoLabel} transform={`translate(${-badgeWidth / 2} 14)`}>
        <rect width={badgeWidth} height="22" rx="6" />
        <text x={badgeWidth / 2} y="14.5" textAnchor="middle">{label}</text>
      </g>
    </g>
  )
}

function IsometricBarrier({
  barrier,
  scene,
}: {
  barrier: NonNullable<ReturnType<typeof projectCityWorld>['barrier']>
  scene: CitySceneDefinition
}) {
  const position = barrierPosition(scene, barrier.routeId, barrier.checkpointId, barrier.nodeId)
  if (!position) return null
  const isClosed = barrier.state === 'closed'

  return (
    <g
      className={`${styles.barrier} ${isClosed ? styles.barrierClosed : styles.barrierOpen}`}
      transform={`translate(${position.x} ${position.y})`}
      data-city-barrier={barrier.state}
    >
      {/* Post */}
      <rect x="-24" y="-26" width="8" height="26" rx="2" fill="#334155" stroke="#0f172a" strokeWidth="1.4" />
      <circle cx="-20" cy="-28" r="5" fill={isClosed ? '#f43f5e' : '#10b981'} stroke="#0f172a" strokeWidth="1.2" />
      {/* Boom Pole */}
      {isClosed ? (
        <g>
          <path d="M-18 -16 L28 4" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
          <path d="M-18 -16 L28 4" stroke="#e11d48" strokeWidth="7" strokeDasharray="7 7" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d="M-18 -16 L6 -44" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
          <path d="M-18 -16 L6 -44" stroke="#10b981" strokeWidth="5" strokeDasharray="6 6" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

function FiberSignalOverlay({
  scene,
  signal,
  showChapterOneAckBubble,
  onInspect,
}: {
  scene: CitySceneDefinition
  signal: NonNullable<ReturnType<typeof projectCityWorld>['signal']>
  showChapterOneAckBubble: boolean
  onInspect: (nodeId: string) => void
}) {
  const fromNode = scene.nodes.find((n) => n.id === signal.fromNodeId)
  const toNode = scene.nodes.find((n) => n.id === signal.toNodeId)
  if (!fromNode || !toNode) return null

  const matchingRoute = scene.routes.find(
    (route) => route.fromNodeId === signal.fromNodeId && route.toNodeId === signal.toNodeId,
  )
  const pathD = matchingRoute
    ? matchingRoute.path
    : pointsToSvgPath([
        fromNode.position,
        {
          x: (fromNode.position.x + toNode.position.x) / 2,
          y: Math.min(fromNode.position.y, toNode.position.y) - 68,
        },
        toNode.position,
      ])

  const control = signal.kind === 'metadata' || signal.kind === 'assignment' || signal.kind === 'revocation' || signal.kind.startsWith('tx-')
  const tone = signal.state === 'failed' || signal.state === 'blocked' ? 'failed' : control ? 'control' : 'success'
  const markerId = tone === 'failed' ? 'url(#iso-signal-arrow-failed)' : tone === 'control' ? 'url(#iso-signal-arrow-control)' : 'url(#iso-signal-arrow-success)'

  return (
    <g
      className={`${styles.signal} ${styles[`signal_${tone}`]}`}
      data-city-signal={signal.kind}
    >
      <path className={styles.signalTrack} d={pathD} />
      <path className={styles.signalPulseLine} d={pathD} markerEnd={markerId} />
      <g className={styles.signalBeacon} transform={`translate(${toNode.position.x} ${toNode.position.y})`} data-signal-marker={tone}>
        <circle r="18" />
        <circle r="7" />
      </g>

      {showChapterOneAckBubble && (
        <CityFacility
          nodeId="ack"
          accessibleName="Producer 도착 문자, 완료"
          onInspect={onInspect}
          hitAreaClassName={styles.hitArea}
          hitAreaPath={`M${toNode.position.x - 135} ${toNode.position.y - 160} H${toNode.position.x + 135} V${toNode.position.y - 84} H${toNode.position.x - 135} Z`}
          className={styles.ackCardButton}
        >
          <g className={styles.ackCard} transform={`translate(${toNode.position.x - 132} ${toNode.position.y - 156})`}>
            <rect width="264" height="72" rx="10" />
            <circle cx="22" cy="24" r="10" fill="#10b981" />
            <path d="M17 24 L21 28 L27 20" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <text x="40" y="26" className={styles.ackTitle}>기록 완료 문자가 도착했습니다</text>
            <text x="16" y="47" className={styles.ackMeta}>orders.v1 / partition 0 / offset 42 저장 완료</text>
            <text x="16" y="62" className={styles.ackMeta}>acks=all · broker-1</text>
          </g>
        </CityFacility>
      )}
    </g>
  )
}

function buildFacilityModels(
  scene: CitySceneDefinition,
  nodes: readonly CityNodeState[],
): PhysicalFacilityModel[] {
  const byFacility = new Map<string, CityNodeState[]>()
  for (const node of nodes) {
    const group = byFacility.get(node.facilityId) ?? []
    group.push(node)
    byFacility.set(node.facilityId, group)
  }

  return scene.physicalFacilities
    .filter((facility) => byFacility.has(facility.id))
    .map((definition) => {
      const facilityNodes = byFacility.get(definition.id) ?? []
      const state = facilityNodes.reduce<CityVisualState>(
        (current, node) => (visualStatePriority(node.state) > visualStatePriority(current) ? node.state : current),
        'idle',
      )
      return {
        definition,
        focused: facilityNodes.some((node) => node.focused),
        nodes: facilityNodes,
        state,
        depthOrder: definition.grid.v - definition.grid.u,
      }
    })
    .sort((left, right) => left.depthOrder - right.depthOrder)
}

function resolveDisplayCarriers(
  scene: CitySceneDefinition,
  prevWorld: CityWorldState,
  targetWorld: CityWorldState,
  carrierProgress: number | undefined,
): readonly DisplayCarrierModel[] {
  const targets = Object.values(targetWorld.carriers)
  const targetPrimary = targetWorld.carriers.vehicle
  const prevPrimary = prevWorld.carriers.vehicle

  const fromP = prevPrimary?.journeyProgress ?? 0
  const toP = targetPrimary?.journeyProgress ?? 0

  const isInterpolating = carrierProgress !== undefined
    && targetPrimary
    && prevPrimary
    && toP > fromP + 0.0001
    && carrierProgress >= fromP - 0.001
    && carrierProgress < toP - 0.0005

  if (!isInterpolating) {
    return targets.flatMap((carrier) => {
      const route = targetWorld.routes[carrier.routeId]
      if (!route) return []
      return [{
        carrier,
        position: carrier.position,
        heading: carrier.heading,
        route,
        progress: carrier.journeyProgress,
      }]
    })
  }

  const ratio = clampProgress((carrierProgress - fromP) / (toP - fromP))
  const transitions = buildCarrierTransitions(scene, prevWorld, targetWorld)
  return transitions.flatMap((transition) => {
    const route = targetWorld.routes[transition.toCarrier.routeId]
    if (!route) return []
    const position = interpolatePolyline(transition.points, ratio)
    const heading = headingAtPolylineProgress(transition.points, ratio)
    return [{
      carrier: transition.toCarrier,
      position,
      heading,
      route,
      progress: transition.toCarrier.id === 'vehicle' ? carrierProgress : transition.toCarrier.journeyProgress,
    }]
  })
}

function facilityAccessibleName(facility: PhysicalFacilityModel): string {
  const base = `${facility.definition.label} ${facility.definition.koreanLabel}, ${STATE_LABELS[facility.state]}`
  if (facility.nodes.length <= 1) return base
  const detail = facility.nodes
    .map((node) => `${node.label} ${node.badge ?? STATE_LABELS[node.state]}`)
    .join(', ')
  return `${base}, ${detail}`
}

function facilityColorForState(archetype: CityBuildingArchetype, state: CityVisualState): string {
  if (state === 'failed') return '#e11d48'
  if (state === 'blocked') return '#f59e0b'
  if (state === 'muted') return '#64748b'
  return ARCHETYPE_COLORS[archetype]
}

function vehicleColorsForKind(kind: CityCarrierKind): { body: string; cab: string } {
  switch (kind) {
    case 'retry-record':
      return { body: '#f97316', cab: '#fdba74' }
    case 'ghost-record':
      return { body: '#e11d48', cab: '#fda4af' }
    case 'offset-ticket':
      return { body: '#06b6d4', cab: '#67e8f9' }
    case 'record':
      return { body: '#f5b82e', cab: '#ffd666' }
  }
}

function carrierDisplayLabel(carrier: CityCarrierState, chapterId: number, attempt?: number): string {
  if (chapterId === 1) {
    return attempt && attempt > 0 ? `order-2401 · #${attempt}` : 'order-2401'
  }
  const label = carrier.label ?? carrier.id
  return carrier.cueCount > 1 && /^\d+\s+records?\b/i.test(label) ? '메시지 흐름 요약' : label
}

function logicalBadgeText(node: CityNodeState): string {
  const status = node.badge ?? STATE_LABELS[node.state]
  return `${node.label.replace(/\s+/g, '')} · ${status}`
}

function logicalGroupSummary(nodes: readonly CityNodeState[], previewNodeIds: readonly string[]): string {
  const previewed = nodes.filter((n) => previewNodeIds.includes(n.id))
  if (previewed.length > 0) return `선택 ${previewed.map((n) => n.label).join('·')}`
  const activeCount = nodes.filter((n) => n.state === 'active' || n.state === 'complete').length
  return `${nodes.length}개 논리 노드 · ${activeCount} 활성`
}

function visualStatePriority(state: CityVisualState): number {
  return ({ failed: 5, blocked: 4, active: 3, complete: 2, muted: 1, idle: 0 } as const)[state]
}

function cityHudItems(
  scene: CitySceneDefinition,
  world: CityWorldState,
  pendingRerun: boolean,
): CityHudItem[] {
  const items: CityHudItem[] = []
  if (pendingRerun) {
    items.push({ icon: '↻', key: 'pending-rerun', label: '수정 대기 · 재실행 필요', state: 'blocked' })
  }
  if (world.barrier) {
    items.push({
      icon: world.barrier.state === 'closed' ? '!' : '✓',
      key: `barrier-${world.barrier.state}`,
      label: world.barrier.label,
      state: world.barrier.state === 'closed' ? 'blocked' : 'complete',
    })
  }
  if (world.signal) {
    const control = world.signal.kind === 'metadata' || world.signal.kind === 'assignment' || world.signal.kind === 'revocation' || world.signal.kind.startsWith('tx-')
    items.push({
      icon: world.signal.state === 'failed' || world.signal.state === 'blocked' ? '!' : control ? '↺' : '✓',
      key: `signal-${world.signal.kind}`,
      label: world.signal.label,
      state: world.signal.state,
    })
  }
  for (const boundary of scene.boundaries ?? []) {
    const boundaryNodes = boundary.nodeIds.flatMap((id) => (world.nodes[id] ? [world.nodes[id]] : []))
    const state = boundaryNodes.reduce<CityVisualState>(
      (curr, node) => (visualStatePriority(node.state) > visualStatePriority(curr) ? node.state : curr),
      'idle',
    )
    const focused = boundary.nodeIds.some((id) => world.focusNodeIds.includes(id))
    if (state === 'idle' && !focused) continue
    items.push({ icon: 'TX', key: `boundary-${boundary.id}`, label: boundary.label, state: state === 'idle' ? 'active' : state })
  }
  return items
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
