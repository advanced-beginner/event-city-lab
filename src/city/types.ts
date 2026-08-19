export type CityNodeKind =
  | 'producer'
  | 'partition'
  | 'broker'
  | 'replica'
  | 'consumer'
  | 'coordinator'
  | 'offset'
  | 'retry'
  | 'application'
  | 'transaction'
  | 'generic'

export type CityVisualState = 'idle' | 'active' | 'blocked' | 'failed' | 'complete' | 'muted'
export type CityRouteKind = 'data' | 'replication' | 'control' | 'retry' | 'return' | 'transaction'
export type CityCarrierKind = 'record' | 'retry-record' | 'offset-ticket' | 'ghost-record'
export type CitySignalKind = 'ack' | 'commit' | 'assignment' | 'revocation' | 'metadata' | 'tx-commit' | 'tx-abort'

export interface CityPoint {
  x: number
  y: number
}

export interface CitySize {
  width: number
  height: number
}

export interface CityNodeDefinition {
  id: string
  kind: CityNodeKind
  label: string
  description: string
  position: CityPoint
  hitAreaPath: string
  size?: CitySize
  ariaLabel?: string
}

export interface CityCheckpointDefinition {
  id: string
  position: CityPoint
  label?: string
  nodeId?: string
}

export interface CityRouteDefinition {
  id: string
  kind: CityRouteKind
  fromNodeId: string
  toNodeId: string
  path: string
  checkpoints: readonly CityCheckpointDefinition[]
  label?: string
}

export interface CityBoundaryDefinition {
  id: string
  kind: 'transaction'
  label: string
  path: string
  nodeIds: readonly string[]
}

export interface CitySceneDefinition {
  id: string
  label: string
  viewport: CitySize
  nodes: readonly CityNodeDefinition[]
  routes: readonly CityRouteDefinition[]
  boundaries?: readonly CityBoundaryDefinition[]
}

export interface CityNodeChange {
  state?: CityVisualState
  label?: string
  badge?: string | null
}

export interface CityRouteChange {
  state?: CityVisualState
  disabled?: boolean
  label?: string
}

export interface CityCarrierChange {
  kind: CityCarrierKind
  routeId: string
  checkpointId?: string
  progress?: number
  state?: CityVisualState
  label?: string
}

export interface CitySignalCue {
  kind: CitySignalKind
  fromNodeId: string
  toNodeId: string
  state: CityVisualState
  label: string
}

export interface CityBarrierCue {
  state: 'open' | 'closed'
  label: string
  nodeId?: string
  routeId?: string
  checkpointId?: string
}

export interface ChapterCityCue {
  focusNodeIds: readonly string[]
  nodeChanges?: Readonly<Record<string, CityNodeChange>>
  routeChanges?: Readonly<Record<string, CityRouteChange>>
  carrierChanges?: Readonly<Record<string, CityCarrierChange | null>>
  signal?: CitySignalCue | null
  barrier?: CityBarrierCue | null
}

export interface CityNodeState extends CityNodeDefinition {
  focused: boolean
  state: CityVisualState
  badge: string | null
}

export interface CityRouteState extends CityRouteDefinition {
  state: CityVisualState
  disabled: boolean
}

export interface CityCarrierState extends CityCarrierChange {
  id: string
}

export interface CityWorldState {
  sceneId: string
  focusNodeIds: readonly string[]
  nodes: Readonly<Record<string, CityNodeState>>
  routes: Readonly<Record<string, CityRouteState>>
  carriers: Readonly<Record<string, CityCarrierState>>
  signal: CitySignalCue | null
  barrier: CityBarrierCue | null
}

export interface CityCuedEvent {
  cityCue: ChapterCityCue
}
