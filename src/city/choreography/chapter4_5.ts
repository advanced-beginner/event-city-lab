import type { ChapterCityCue, CityCarrierChange, CityRouteChange, CitySignalCue } from '../types'
import type { ChapterCityCueBuilder, CityCueContext } from './types'

type NodeId =
  | 'producer'
  | 'broker-leader'
  | 'broker-follower-1'
  | 'broker-follower-2'
  | 'partition-p0'
  | 'consumer-c1'
  | 'application'
  | 'offset-store'

type RouteId =
  | 'producer-leader'
  | 'leader-follower-1'
  | 'leader-follower-2'
  | 'follower-1-producer'
  | 'leader-producer-ack'
  | 'p0-consumer'
  | 'consumer-application'
  | 'application-offset'
  | 'consumer-offset'
  | 'offset-consumer-commit'

export const buildChapter45CityCue: ChapterCityCueBuilder = (context) => {
  if (context.chapterId === 4) return buildChapter4CityCue(context)
  if (context.chapterId === 5) return buildChapter5CityCue(context)

  return { focusNodeIds: [nodeForComponent(context.event.component)] }
}

function buildChapter4CityCue(context: CityCueContext): ChapterCityCue {
  const focusNodeIds = focusForChapter4(context)
  const terminal = isTerminal(context)
  const failed = terminal && context.outcomeStatus === 'failed'
  const succeeded = terminal && context.outcomeStatus === 'succeeded'
  const routeId = chapter4RouteFor(context)
  const carrier = chapter4CarrierFor(context, routeId)

  return {
    focusNodeIds,
    nodeChanges: {
      ...baseFocusNodeChanges(focusNodeIds, context),
      ...chapter4SemanticNodeChanges(context),
      ...(failed ? terminalFailedNode(context) : {}),
      ...(succeeded ? chapter4SuccessNodes(context) : {}),
    },
    routeChanges: {
      ...activeRoute(routeId, context.event.state),
      ...chapter4SemanticRouteChanges(context),
      ...(failed ? terminalFailedRoute(routeId) : {}),
      ...(succeeded ? terminalCompleteRoute(routeId) : {}),
    },
    carrierChanges: {
      record: carrier,
    },
    signal: chapter4Signal(context, succeeded),
    barrier: failed
      ? {
          state: 'closed',
          label: context.experimentId === 'leader-failover' ? 'leader election barrier' : 'ISR durability barrier',
          nodeId: failedBarrierNode(context),
          routeId,
          checkpointId: `${routeId}:end`,
        }
      : succeeded
        ? {
            state: 'open',
            label: context.experimentId === 'leader-failover' ? 'new leader ready' : 'ISR quorum satisfied',
            routeId,
            checkpointId: `${routeId}:end`,
          }
        : null,
  }
}

function buildChapter5CityCue(context: CityCueContext): ChapterCityCue {
  const focusNodeIds = focusForChapter5(context)
  const terminal = isTerminal(context)
  const failed = terminal && context.outcomeStatus === 'failed'
  const succeeded = terminal && context.outcomeStatus === 'succeeded'
  const routeId = chapter5RouteFor(context)
  const carrier = chapter5CarrierFor(context, routeId)

  return {
    focusNodeIds,
    nodeChanges: {
      ...baseFocusNodeChanges(focusNodeIds, context),
      ...chapter5SemanticNodeChanges(context),
      ...(failed ? terminalFailedNode(context) : {}),
      ...(succeeded ? chapter5SuccessNodes(context) : {}),
    },
    routeChanges: {
      ...activeRoute(routeId, context.event.state),
      ...chapter5SemanticRouteChanges(context),
      ...(failed ? terminalFailedRoute(routeId) : {}),
      ...(succeeded ? terminalCompleteRoute(routeId) : {}),
    },
    carrierChanges: {
      record: carrier,
    },
    signal: succeeded ? chapter5SuccessSignal(context) : null,
    barrier: failed
      ? {
          state: 'closed',
          label: context.experimentId === 'late-commit-replay' ? 'duplicate-effect barrier' : 'offset safety barrier',
          nodeId: failedBarrierNode(context),
          routeId,
          checkpointId: `${routeId}:end`,
        }
      : succeeded
        ? {
            state: 'open',
            label: 'offset boundary confirmed',
            routeId,
            checkpointId: `${routeId}:end`,
          }
        : null,
  }
}

function focusForChapter4(context: CityCueContext): readonly NodeId[] {
  if (context.experimentId === 'replica-lag') {
    if (context.sequence === 0) return ['broker-leader', 'broker-follower-1', 'broker-follower-2']
    if (context.choiceId === 'inspect-current-isr' && context.sequence === 1) {
      return ['broker-follower-1', 'broker-follower-2']
    }
    return ['broker-follower-2']
  }

  if (context.experimentId === 'min-isr-write-failure') {
    if (context.sequence === 0) return ['broker-leader', 'broker-follower-1']
    if (context.sequence === 1) return context.choiceId === 'restore-isr-before-write'
      ? ['broker-follower-1', 'broker-leader']
      : ['producer', 'broker-leader']
    return ['broker-leader', 'broker-follower-1']
  }

  if (context.sequence === 0) return context.choiceId === 'retry-before-election'
    ? ['broker-leader']
    : ['broker-follower-1', 'broker-follower-2']
  if (context.sequence === 1) return ['producer', 'broker-follower-1']
  return context.choiceId === 'retry-before-election' ? ['producer', 'broker-leader'] : ['broker-follower-1', 'producer']
}

function focusForChapter5(context: CityCueContext): readonly NodeId[] {
  if (context.experimentId === 'poll-versus-process') {
    if (context.sequence === 0) return ['partition-p0', 'consumer-c1']
    if (context.sequence === 1) return ['consumer-c1', 'application']
    return ['application', 'offset-store']
  }

  if (context.experimentId === 'early-commit-loss') {
    if (context.sequence === 0) return context.choiceId === 'commit-before-processing'
      ? ['consumer-c1', 'offset-store']
      : ['partition-p0', 'consumer-c1']
    if (context.sequence === 1) return ['consumer-c1', 'application']
    return context.choiceId === 'commit-before-processing' ? ['consumer-c1', 'offset-store'] : ['application', 'offset-store']
  }

  if (context.sequence === 0) return context.choiceId === 'assume-no-replay-after-processing'
    ? ['application', 'offset-store']
    : ['partition-p0', 'consumer-c1']
  if (context.sequence === 1) return ['consumer-c1', 'application']
  return context.choiceId === 'assume-no-replay-after-processing' ? ['application'] : ['application', 'offset-store']
}

function chapter4RouteFor(context: CityCueContext): RouteId {
  if (context.experimentId === 'replica-lag') {
    return context.sequence === 0 || context.choiceId === 'inspect-current-isr'
      ? 'leader-follower-1'
      : 'leader-follower-2'
  }

  if (context.experimentId === 'min-isr-write-failure') {
    if (context.sequence === 0) return 'leader-follower-1'
    if (context.sequence === 1) return context.choiceId === 'restore-isr-before-write'
      ? 'leader-follower-1'
      : 'producer-leader'
    return context.choiceId === 'restore-isr-before-write' ? 'leader-producer-ack' : 'producer-leader'
  }

  if (context.sequence === 0) return context.choiceId === 'retry-before-election'
    ? 'producer-leader'
    : 'leader-follower-1'
  if (context.sequence === 1) return 'follower-1-producer'
  return context.choiceId === 'retry-before-election' ? 'producer-leader' : 'leader-producer-ack'
}

function chapter5RouteFor(context: CityCueContext): RouteId {
  if (context.experimentId === 'poll-versus-process') {
    if (context.sequence === 0) return 'p0-consumer'
    if (context.sequence === 1) return 'consumer-application'
    return context.choiceId === 'process-then-commit' ? 'application-offset' : 'consumer-offset'
  }

  if (context.experimentId === 'early-commit-loss') {
    if (context.sequence === 0) return context.choiceId === 'commit-before-processing' ? 'consumer-offset' : 'p0-consumer'
    if (context.sequence === 1) return 'consumer-application'
    return context.choiceId === 'commit-after-processing' ? 'application-offset' : 'p0-consumer'
  }

  if (context.sequence === 0) return context.choiceId === 'assume-no-replay-after-processing'
    ? 'application-offset'
    : 'p0-consumer'
  if (context.sequence === 1) return 'p0-consumer'
  return context.choiceId === 'idempotent-replay-then-commit' ? 'application-offset' : 'consumer-application'
}

function chapter4CarrierFor(context: CityCueContext, routeId: RouteId): CityCarrierChange | null {
  if (context.event.kind !== 'record.dispatched') return null
  return {
    kind: 'record',
    routeId,
    checkpointId: `${routeId}:end`,
    progress: progressFor(context),
    state: context.event.state,
    label: chapter4CarrierLabel(context),
  }
}

function chapter5CarrierFor(context: CityCueContext, routeId: RouteId): CityCarrierChange {
  const isReplay = context.experimentId === 'late-commit-replay'
    && (context.choiceId === 'idempotent-replay-then-commit' || context.sequence === 2)

  return {
    kind: isReplay ? 'ghost-record' : routeId.includes('offset') ? 'offset-ticket' : 'record',
    routeId,
    checkpointId: `${routeId}:end`,
    progress: progressFor(context),
    state: context.event.state,
    label: chapter5CarrierLabel(context),
  }
}

function chapter4SemanticNodeChanges(context: CityCueContext): ChapterCityCue['nodeChanges'] {
  if (context.experimentId === 'replica-lag') {
    return context.choiceId === 'inspect-current-isr'
      ? {
          'broker-leader': { state: 'complete', badge: 'leader' },
          'broker-follower-1': { state: 'complete', badge: 'ISR' },
          'broker-follower-2': { state: context.sequence === 1 ? 'blocked' : 'muted', badge: 'out' },
        }
      : {
          'broker-leader': { state: 'complete', badge: 'leader' },
          'broker-follower-1': { state: 'complete', badge: 'ISR' },
          'broker-follower-2': { state: 'blocked', badge: 'lag' },
        }
  }

  if (context.experimentId === 'min-isr-write-failure') {
    return context.choiceId === 'restore-isr-before-write'
      ? {
          'broker-leader': { state: 'complete', badge: 'ISR 1' },
          'broker-follower-1': { state: 'complete', badge: 'ISR 2' },
          'broker-follower-2': { state: 'muted', badge: 'out' },
        }
      : {
          'broker-leader': { state: 'blocked', badge: 'ISR 1/2' },
          'broker-follower-1': { state: 'failed', badge: 'out' },
          'broker-follower-2': { state: 'muted', badge: 'out' },
        }
  }

  return context.choiceId === 'wait-for-isr-leader-and-retry'
    ? {
        'broker-leader': { state: 'muted', badge: 'old' },
        'broker-follower-1': { state: 'complete', badge: 'new leader' },
        'broker-follower-2': { state: 'complete', badge: 'ISR' },
      }
    : {
        'broker-leader': { state: 'failed', badge: 'down' },
        producer: { state: context.sequence === 1 ? 'blocked' : 'failed', badge: 'stale metadata' },
      }
}

function chapter5SemanticNodeChanges(context: CityCueContext): ChapterCityCue['nodeChanges'] {
  if (context.experimentId === 'poll-versus-process') {
    return context.choiceId === 'process-then-commit'
      ? {
          'consumer-c1': { state: 'complete', badge: 'position +1' },
          application: { state: context.sequence >= 1 ? 'complete' : 'idle', badge: context.sequence >= 1 ? 'processed' : null },
          'offset-store': { state: context.sequence === 2 ? 'complete' : 'idle', badge: context.sequence === 2 ? '41' : null },
        }
      : {
          'consumer-c1': { state: 'blocked', badge: 'position 41' },
          application: { state: context.sequence >= 1 ? 'failed' : 'idle', badge: context.sequence >= 1 ? 'not processed' : null },
          'offset-store': { state: context.sequence === 2 ? 'failed' : 'idle', badge: context.sequence === 2 ? '40' : null },
        }
  }

  if (context.experimentId === 'early-commit-loss') {
    return context.choiceId === 'commit-after-processing'
      ? {
          'consumer-c1': { state: 'complete', badge: 'offset 50' },
          application: { state: context.sequence >= 1 ? 'complete' : 'idle', badge: context.sequence >= 1 ? 'processed' : null },
          'offset-store': { state: context.sequence === 2 ? 'complete' : 'idle', badge: context.sequence === 2 ? '51' : null },
        }
      : {
          'consumer-c1': { state: 'failed', badge: 'restart 51' },
          application: { state: context.sequence >= 1 ? 'failed' : 'idle', badge: context.sequence >= 1 ? 'absent' : null },
          'offset-store': { state: 'blocked', badge: '51 early' },
        }
  }

  return context.choiceId === 'idempotent-replay-then-commit'
    ? {
        'consumer-c1': { state: 'complete', badge: 'replay 70' },
        application: { state: 'complete', badge: 'idempotent' },
        'offset-store': { state: context.sequence === 2 ? 'complete' : 'idle', badge: context.sequence === 2 ? '71' : null },
      }
    : {
        'consumer-c1': { state: context.sequence >= 1 ? 'failed' : 'blocked', badge: 'restart 70' },
        application: { state: context.sequence === 2 ? 'failed' : 'complete', badge: context.sequence === 2 ? 'duplicate' : 'processed' },
        'offset-store': { state: 'blocked', badge: '70' },
      }
}

function chapter4SemanticRouteChanges(context: CityCueContext): Readonly<Record<string, CityRouteChange>> {
  if (context.experimentId === 'replica-lag') {
    return {
      'leader-follower-1': { state: 'complete', label: 'ISR follower catches up' },
      'leader-follower-2': { state: context.choiceId === 'inspect-current-isr' ? 'muted' : 'blocked', label: 'lagging follower outside ISR' },
    }
  }

  if (context.experimentId === 'min-isr-write-failure') {
    return {
      'leader-follower-1': { state: context.choiceId === 'restore-isr-before-write' ? 'complete' : 'failed' },
      'leader-follower-2': { state: 'muted', disabled: true },
    }
  }

  return {
    'producer-leader': { state: context.choiceId === 'retry-before-election' ? 'failed' : 'muted', disabled: context.choiceId === 'retry-before-election' },
    'leader-follower-1': { state: context.choiceId === 'wait-for-isr-leader-and-retry' ? 'complete' : 'failed' },
  }
}

function chapter5SemanticRouteChanges(context: CityCueContext): Readonly<Record<string, CityRouteChange>> {
  if (context.experimentId === 'poll-versus-process') {
    return {
      'p0-consumer': { state: 'complete' },
      'consumer-application': { state: context.choiceId === 'process-then-commit' ? 'complete' : 'failed' },
      'application-offset': { state: context.choiceId === 'process-then-commit' ? 'complete' : 'blocked' },
    }
  }

  if (context.experimentId === 'early-commit-loss') {
    return {
      'consumer-offset': { state: context.choiceId === 'commit-before-processing' ? 'blocked' : 'muted' },
      'consumer-application': { state: context.choiceId === 'commit-after-processing' ? 'complete' : 'failed' },
      'application-offset': { state: context.choiceId === 'commit-after-processing' ? 'complete' : 'failed' },
    }
  }

  return {
    'p0-consumer': { state: 'complete' },
    'consumer-application': { state: context.choiceId === 'idempotent-replay-then-commit' ? 'complete' : 'failed' },
    'application-offset': { state: context.choiceId === 'idempotent-replay-then-commit' ? 'complete' : 'blocked' },
  }
}

function chapter4SuccessSignal(context: CityCueContext): CitySignalCue {
  if (context.experimentId === 'leader-failover') {
    return {
      kind: 'ack',
      fromNodeId: 'broker-follower-1',
      toNodeId: 'producer',
      state: 'complete',
      label: 'ACK from new leader',
    }
  }

  return {
    kind: 'ack',
    fromNodeId: 'broker-leader',
    toNodeId: 'producer',
    state: 'complete',
    label: 'ACK after ISR quorum',
  }
}

function chapter4Signal(context: CityCueContext, succeeded: boolean): CitySignalCue | null {
  if (
    context.experimentId === 'leader-failover'
    && context.choiceId === 'wait-for-isr-leader-and-retry'
    && context.sequence === 1
  ) {
    return {
      kind: 'metadata',
      fromNodeId: 'broker-follower-1',
      toNodeId: 'producer',
      state: 'active',
      label: 'metadata · new leader',
    }
  }
  return succeeded ? chapter4SuccessSignal(context) : null
}

function chapter5SuccessSignal(context: CityCueContext): CitySignalCue {
  return {
    kind: 'commit',
    fromNodeId: 'offset-store',
    toNodeId: 'consumer-c1',
    state: 'complete',
    label: context.experimentId === 'late-commit-replay' ? 'commit offset 71' : 'commit next offset',
  }
}

function chapter4SuccessNodes(context: CityCueContext): ChapterCityCue['nodeChanges'] {
  if (context.experimentId === 'leader-failover') {
    return {
      'broker-follower-1': { state: 'complete', badge: 'leader' },
      producer: { state: 'complete', badge: 'acked' },
    }
  }

  return {
    'broker-leader': { state: 'complete', badge: 'acked' },
    producer: { state: 'complete', badge: 'acks=all' },
  }
}

function chapter5SuccessNodes(_context: CityCueContext): ChapterCityCue['nodeChanges'] {
  return {
    application: { state: 'complete', badge: 'processed' },
    'offset-store': { state: 'complete', badge: 'committed' },
    'consumer-c1': { state: 'complete', badge: 'safe' },
  }
}

function baseFocusNodeChanges(
  focusNodeIds: readonly NodeId[],
  context: CityCueContext,
): ChapterCityCue['nodeChanges'] {
  return Object.fromEntries(
    focusNodeIds.map((nodeId) => [nodeId, { state: context.event.state }]),
  )
}

function terminalFailedNode(context: CityCueContext): ChapterCityCue['nodeChanges'] {
  return {
    [nodeForComponent(context.event.component)]: { state: 'failed', badge: 'failed' },
  }
}

function activeRoute(routeId: RouteId, state: CityCueContext['event']['state']): Readonly<Record<string, CityRouteChange>> {
  return {
    [routeId]: { state },
  }
}

function terminalFailedRoute(routeId: RouteId): Readonly<Record<string, CityRouteChange>> {
  return {
    [routeId]: { state: 'failed', disabled: true },
  }
}

function terminalCompleteRoute(routeId: RouteId): Readonly<Record<string, CityRouteChange>> {
  return {
    [routeId]: { state: 'complete' },
  }
}

function failedBarrierNode(context: CityCueContext): NodeId {
  return nodeForComponent(context.event.component)
}

function nodeForComponent(component: CityCueContext['event']['component']): NodeId {
  if (component === 'broker') return 'broker-leader'
  if (component === 'replica') return 'broker-follower-1'
  if (component === 'partition') return 'partition-p0'
  if (component === 'offset') return 'offset-store'
  if (component === 'consumer') return 'consumer-c1'
  if (component === 'application') return 'application'
  return 'producer'
}

function progressFor(context: CityCueContext): number {
  if (context.eventCount <= 1) return 1
  return Math.min(1, Math.max(0, context.sequence / (context.eventCount - 1)))
}

function isTerminal(context: CityCueContext): boolean {
  return context.sequence === context.eventCount - 1
}

function chapter4CarrierLabel(context: CityCueContext): string {
  if (context.experimentId === 'replica-lag') return 'ISR view'
  if (context.experimentId === 'min-isr-write-failure') return context.choiceId === 'restore-isr-before-write' ? 'acks=all' : 'min ISR block'
  return context.choiceId === 'wait-for-isr-leader-and-retry' ? 'retry after election' : 'stale leader retry'
}

function chapter5CarrierLabel(context: CityCueContext): string {
  if (context.experimentId === 'poll-versus-process') return context.choiceId === 'process-then-commit' ? 'poll -> process -> commit' : 'poll is not processing'
  if (context.experimentId === 'early-commit-loss') return context.choiceId === 'commit-after-processing' ? 'process before commit' : 'early commit skip'
  return context.choiceId === 'idempotent-replay-then-commit' ? 'idempotent replay' : 'duplicate replay'
}
