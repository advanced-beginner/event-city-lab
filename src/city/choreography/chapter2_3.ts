import type { ChapterEventState, ChapterEventTemplate } from '../../domain/chapterSimulation'
import type {
  ChapterCityCue,
  CityCarrierChange,
  CityNodeChange,
  CityRouteChange,
  CitySignalCue,
  CityVisualState,
} from '../types'
import type { ChapterCityCueBuilder, CityCueContext } from './types'

type NodeId =
  | 'producer'
  | 'partition-p0'
  | 'partition-p1'
  | 'partition-p2'
  | 'application'
  | 'broker-leader'
  | 'broker-follower-1'
  | 'broker-follower-2'
  | 'retry-loop'

type RouteId =
  | 'producer-p0'
  | 'producer-p1'
  | 'producer-p2'
  | 'p0-application'
  | 'p1-application'
  | 'p2-application'
  | 'application-producer-result'
  | 'producer-leader'
  | 'leader-follower-1'
  | 'leader-follower-2'
  | 'producer-retry-loop'
  | 'retry-loop-leader'
  | 'leader-partition'
  | 'leader-producer-ack'
  | 'partition-application'

type PartitionNodeId = 'partition-p0' | 'partition-p1' | 'partition-p2'
type CarrierCue = CityCarrierChange & { readonly id: string }

const componentFocusNodes: Partial<Record<ChapterEventTemplate['component'], readonly NodeId[]>> = {
  producer: ['producer'],
  partition: ['partition-p1'],
  broker: ['broker-leader'],
  replica: ['broker-leader', 'broker-follower-1', 'broker-follower-2'],
  retry: ['retry-loop'],
  application: ['application'],
}

const chapter2PartitionByChoice: Record<string, readonly PartitionNodeId[]> = {
  'random-key-per-record': ['partition-p0', 'partition-p2', 'partition-p1'],
  'stable-customer-key': ['partition-p1'],
  'omit-key-and-assume-order': ['partition-p0', 'partition-p2'],
  'restore-business-key': ['partition-p2'],
  'sort-offsets-globally': ['partition-p0', 'partition-p1'],
  'partition-local-timeline': ['partition-p0', 'partition-p1'],
}

const chapter2RouteByPartition: Record<PartitionNodeId, RouteId> = {
  'partition-p0': 'producer-p0',
  'partition-p1': 'producer-p1',
  'partition-p2': 'producer-p2',
}

const chapter2ApplicationRouteByPartition: Record<PartitionNodeId, RouteId> = {
  'partition-p0': 'p0-application',
  'partition-p1': 'p1-application',
  'partition-p2': 'p2-application',
}

const chapter3RecordRouteByChoice: Record<string, RouteId> = {
  'leader-only-ack': 'producer-leader',
  'wait-for-isr-acks': 'leader-follower-1',
  'unbounded-non-idempotent-retry': 'producer-leader',
  'idempotent-bounded-retry': 'producer-leader',
  'coherent-idempotent-config': 'producer-leader',
}

export const buildChapter23CityCue: ChapterCityCueBuilder = (context) => {
  if (context.chapterId === 2) return buildChapter2CityCue(context)
  if (context.chapterId === 3) return buildChapter3CityCue(context)
  return { focusNodeIds: [] }
}

function buildChapter2CityCue(context: CityCueContext): ChapterCityCue {
  const base = baseCue(context)
  const partitions = chapter2PartitionByChoice[context.choiceId] ?? ['partition-p1']

  if (context.event.kind === 'record.dispatched') {
    const carriers = partitions
      .map((partition, index) => {
        const routeId = chapter2RouteByPartition[partition]
        if (!routeId) return null
        return carrier(`record-${index + 1}`, 'record', routeId, 'end', context.event.state, partition)
      })
      .filter((change): change is CarrierCue => change !== null)

    return {
      ...base,
      focusNodeIds: ['producer', ...partitions],
      nodeChanges: nodeChanges([
        ['producer', 'complete'],
        ...partitions.map((partition) => [partition, context.event.state] as const),
      ]),
      routeChanges: routeChanges(carriers.map((change) => [change.routeId, context.event.state])),
      carrierChanges: carrierChanges(carriers),
    }
  }

  if (context.event.kind === 'evidence.observed') {
    const routes = partitions
      .map((partition) => chapter2ApplicationRouteByPartition[partition])
      .filter((routeId): routeId is RouteId => Boolean(routeId))

    return {
      ...base,
      focusNodeIds: [...partitions, 'application'],
      nodeChanges: nodeChanges([
        ...partitions.map((partition) => [partition, context.event.state] as const),
        ['application', context.event.state],
      ]),
      routeChanges: routeChanges(routes.map((routeId) => [routeId, context.event.state])),
      carrierChanges: carrierChanges(
        routes.map((routeId, index) => carrier(`record-${index + 1}`, 'record', routeId, 'end', context.event.state)),
      ),
    }
  }

  if (isTerminal(context.event)) {
    const failed = context.event.state === 'failed'
    return {
      ...base,
      focusNodeIds: ['application', ...partitions],
      nodeChanges: nodeChanges([
        ['application', context.event.state],
        ...partitions.map((partition) => [partition, failed ? 'blocked' : 'complete'] as const),
      ]),
      routeChanges: {
        'application-producer-result': {
          state: context.event.state,
          disabled: failed,
        },
      },
      carrierChanges: failed
        ? {
            result: carrierChange('ghost-record', 'application-producer-result', 'start', 'failed', 'failed route'),
          }
        : Object.fromEntries(
            partitions.map((partition, index) => [
              `receipt-${partition}`,
              carrierChange('offset-ticket', 'application-producer-result', 'end', 'complete', `${partition} · offset ${42 + index}`),
            ]),
          ),
      signal: failed ? null : signal('ack', 'application', 'producer', 'complete', 'ordering result'),
      barrier: failed
        ? {
            state: 'closed',
            label: 'failed ordering boundary',
            routeId: 'application-producer-result',
            checkpointId: 'application-producer-result:start',
            nodeId: 'application',
          }
        : {
            state: 'open',
            label: 'complete endpoint',
            routeId: 'application-producer-result',
            checkpointId: 'application-producer-result:end',
          },
    }
  }

  return base
}

function buildChapter3CityCue(context: CityCueContext): ChapterCityCue {
  const base = baseCue(context)

  if (context.event.kind === 'record.dispatched') {
    const primaryRoute = chapter3RecordRouteByChoice[context.choiceId] ?? 'producer-leader'
    const replicationRoutes = context.choiceId === 'wait-for-isr-acks' || context.choiceId === 'coherent-idempotent-config'
      ? ['leader-follower-1', 'leader-follower-2'] as const
      : []
    const carriers = [
      carrier('record', 'record', primaryRoute, 'end', context.event.state),
      ...replicationRoutes.map((routeId, index) => carrier(`replica-${index + 1}`, 'record', routeId, 'end', 'complete')),
    ]

    return {
      ...base,
      focusNodeIds: ['producer', 'broker-leader', ...replicationRoutes.map(replicationTarget)],
      nodeChanges: nodeChanges([
        ['producer', 'complete'],
        ['broker-leader', context.event.state],
        ...replicationRoutes.map((routeId) => [replicationTarget(routeId), 'complete'] as const),
      ]),
      routeChanges: routeChanges(carriers.map((change) => [change.routeId, change.state ?? context.event.state])),
      carrierChanges: carrierChanges(carriers),
      ...(context.choiceId === 'leader-only-ack'
        ? { signal: signal('ack', 'broker-leader', 'producer', 'active', 'leader ack') }
        : {}),
    }
  }

  if (context.event.component === 'retry' && context.event.kind === 'state.changed') {
    return {
      ...base,
      focusNodeIds: ['producer', 'retry-loop', 'broker-leader'],
      nodeChanges: nodeChanges([
        ['retry-loop', context.event.state],
        ['broker-leader', context.event.state === 'active' ? 'active' : context.event.state],
      ]),
      routeChanges: routeChanges([
        ['producer-retry-loop', context.event.state],
        ['retry-loop-leader', context.event.state],
      ]),
      carrierChanges: carrierChanges([
        carrier('retry', 'retry-record', 'producer-retry-loop', 'end', context.event.state, 'retry'),
        carrier('retry-return', 'retry-record', 'retry-loop-leader', 'end', context.event.state, 'retry append'),
      ]),
    }
  }

  if (context.event.component === 'replica' && context.event.kind === 'state.changed') {
    return {
      ...base,
      focusNodeIds: ['broker-leader', 'broker-follower-1'],
      nodeChanges: nodeChanges([
        ['broker-leader', context.event.state],
        ['broker-follower-1', context.event.state],
      ]),
      routeChanges: {
        'leader-follower-1': {
          state: context.event.state,
          disabled: context.event.state === 'failed',
        },
      },
      carrierChanges: {
        replica: carrierChange('ghost-record', 'leader-follower-1', 'mid', 'failed', 'missing replica'),
      },
      ...(context.event.state === 'failed'
        ? {
            barrier: {
              state: 'closed',
              label: 'replication gap',
              routeId: 'leader-follower-1',
              checkpointId: 'leader-follower-1:mid',
            },
          }
        : {}),
    }
  }

  if (context.event.kind === 'evidence.observed') {
    const failed = context.event.state === 'blocked'
    return {
      ...base,
      focusNodeIds: failed ? ['broker-leader', 'partition-p1'] : ['broker-leader', 'partition-p1', 'application'],
      nodeChanges: nodeChanges([
        ['broker-leader', context.event.state],
        ['partition-p1', context.event.state],
      ]),
      routeChanges: routeChanges([
        ['leader-partition', context.event.state],
        ['partition-application', failed ? 'blocked' : 'complete'],
      ]),
      carrierChanges: carrierChanges([
        carrier('record', failed ? 'ghost-record' : 'record', 'leader-partition', 'end', failed ? 'blocked' : 'complete'),
      ]),
    }
  }

  if (isTerminal(context.event)) {
    const failed = context.event.state === 'failed'
    return {
      ...base,
      focusNodeIds: failed ? ['application', failedTerminalNode(context)] : ['application', 'producer', 'broker-leader'],
      nodeChanges: nodeChanges([
        ['application', context.event.state],
        [failedTerminalNode(context), failed ? 'failed' : 'complete'],
        ['broker-leader', failed ? 'blocked' : 'complete'],
      ]),
      routeChanges: {
        [terminalRoute(context)]: {
          state: context.event.state,
          disabled: failed,
        },
      },
      carrierChanges: {
        terminal: failed
          ? carrierChange('ghost-record', terminalRoute(context), 'mid', 'failed', 'failed route')
          : carrierChange('record', terminalRoute(context), 'end', 'complete', 'complete'),
      },
      signal: failed ? null : signal('ack', 'broker-leader', 'producer', 'complete', 'ack complete'),
      barrier: failed
        ? {
            state: 'closed',
            label: 'failed producer path',
            routeId: terminalRoute(context),
            checkpointId: `${terminalRoute(context)}:mid`,
            nodeId: failedTerminalNode(context),
          }
        : {
            state: 'open',
            label: 'complete endpoint',
            routeId: terminalRoute(context),
            checkpointId: `${terminalRoute(context)}:end`,
          },
    }
  }

  return base
}

function baseCue(context: CityCueContext): ChapterCityCue {
  const focused = componentFocusNodes[context.event.component] ?? ['application']
  return {
    focusNodeIds: focused,
    nodeChanges: nodeChanges(focused.map((nodeId) => [nodeId, context.event.state])),
    ...(context.sequence === 0 ? { barrier: null, signal: null } : {}),
  }
}

function nodeChanges(changes: readonly (readonly [NodeId, CityVisualState])[]): Readonly<Record<string, CityNodeChange>> {
  return Object.fromEntries(
    changes.map(([nodeId, state]) => [
      nodeId,
      {
        state,
        badge: state === 'failed' ? 'FAIL' : state === 'blocked' ? 'WAIT' : state === 'complete' ? 'OK' : null,
      },
    ]),
  )
}

function routeChanges(
  changes: readonly (readonly [string, ChapterEventState | CityVisualState])[],
): Readonly<Record<string, CityRouteChange>> {
  return Object.fromEntries(
    changes.map(([routeId, state]) => [
      routeId,
      {
        state: toCityState(state),
        disabled: state === 'failed',
      },
    ]),
  )
}

function carrierChanges(carriers: readonly CarrierCue[]): Readonly<Record<string, CityCarrierChange | null>> {
  return Object.fromEntries(carriers.map(({ id, ...change }) => [id, change]))
}

function carrier(
  id: string,
  kind: CityCarrierChange['kind'],
  routeId: RouteId,
  checkpoint: 'start' | 'mid' | 'end',
  state: ChapterEventState | CityVisualState,
  label?: string,
): CarrierCue {
  return {
    id,
    ...carrierChange(kind, routeId, checkpoint, toCityState(state), label),
  }
}

function carrierChange(
  kind: CityCarrierChange['kind'],
  routeId: RouteId,
  checkpoint: 'start' | 'mid' | 'end',
  state: CityVisualState,
  label?: string,
): CityCarrierChange {
  return {
    kind,
    routeId,
    checkpointId: `${routeId}:${checkpoint}`,
    progress: checkpointProgress[checkpoint],
    state,
    ...(label ? { label } : {}),
  }
}

function signal(
  kind: CitySignalCue['kind'],
  fromNodeId: NodeId,
  toNodeId: NodeId,
  state: CityVisualState,
  label: string,
): CitySignalCue {
  return { kind, fromNodeId, toNodeId, state, label }
}

function isTerminal(event: ChapterEventTemplate): boolean {
  return event.kind === 'experiment.failed' || event.kind === 'experiment.succeeded'
}

function toCityState(state: ChapterEventState | CityVisualState): CityVisualState {
  return state === 'blocked' ? 'blocked' : state
}

function replicationTarget(routeId: 'leader-follower-1' | 'leader-follower-2'): NodeId {
  return routeId === 'leader-follower-1' ? 'broker-follower-1' : 'broker-follower-2'
}

function terminalRoute(context: CityCueContext): RouteId {
  if (context.choiceId === 'conflicting-idempotent-config') return 'producer-retry-loop'
  if (context.choiceId === 'unbounded-non-idempotent-retry' || context.choiceId === 'idempotent-bounded-retry') {
    return 'retry-loop-leader'
  }
  return 'leader-producer-ack'
}

function failedTerminalNode(context: CityCueContext): NodeId {
  if (context.choiceId === 'conflicting-idempotent-config') return 'producer'
  if (context.choiceId === 'unbounded-non-idempotent-retry') return 'retry-loop'
  return 'broker-leader'
}

const checkpointProgress = {
  start: 0,
  mid: 0.5,
  end: 1,
} as const
