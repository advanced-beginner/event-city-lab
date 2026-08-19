import type { ChapterCityCue, CityBarrierCue, CityCarrierChange, CityRouteChange, CitySignalCue } from '../types'
import type { CityCueContext } from './types'

type AdvancedNodeId =
  | 'producer'
  | 'partition-p0'
  | 'partition-p1'
  | 'partition-p2'
  | 'consumer-c1'
  | 'consumer-c2'
  | 'consumer-c3'
  | 'consumer-c4'
  | 'consumer-c5'
  | 'coordinator'
  | 'offset-store'
  | 'application'
  | 'retry-loop'
  | 'retry-1m'
  | 'retry-10m'
  | 'dlt'
  | 'transaction-coordinator'

const COMPONENT_FOCUS = {
  producer: 'producer',
  partition: 'partition-p0',
  broker: 'producer',
  replica: 'producer',
  consumer: 'consumer-c1',
  coordinator: 'coordinator',
  offset: 'offset-store',
  retry: 'retry-loop',
  application: 'application',
  transaction: 'transaction-coordinator',
} as const satisfies Record<CityCueContext['event']['component'], AdvancedNodeId>

export function buildChapter68CityCue(context: CityCueContext): ChapterCityCue {
  const focusNodeIds = focusFor(context)
  const primaryNodeId = focusNodeIds[0] ?? COMPONENT_FOCUS[context.event.component]
  const routeId = routeFor(context)
  const terminal = context.event.kind === 'experiment.failed' || context.event.kind === 'experiment.succeeded'
  const failedTerminal = context.event.kind === 'experiment.failed'
  const successTerminal = context.event.kind === 'experiment.succeeded'
  const nodeChanges = nodeChangesFor(context)

  return {
    focusNodeIds,
    nodeChanges: {
      ...nodeChanges,
      [primaryNodeId]: {
        ...(nodeChanges[primaryNodeId] ?? {}),
        state: failedTerminal ? 'failed' : successTerminal ? 'complete' : nodeChanges[primaryNodeId]?.state ?? context.event.state,
      },
    },
    ...(routeId ? { routeChanges: { [routeId]: routeChangeFor(context, failedTerminal, successTerminal) } } : {}),
    ...optionalCarrierChanges(context, routeId),
    signal: signalFor(context),
    barrier: barrierFor(context, primaryNodeId, routeId, terminal),
  }
}

function focusFor(context: CityCueContext): AdvancedNodeId[] {
  if (context.chapterId === 6) return chapter6Focus(context)
  if (context.chapterId === 7) return chapter7Focus(context)
  return chapter8Focus(context)
}

function chapter6Focus(context: CityCueContext): AdvancedNodeId[] {
  if (context.experimentId === 'assignment-capacity') {
    if (context.sequence >= 2 && context.choiceId === 'add-consumers-only') return ['consumer-c4', 'consumer-c5']
    if (context.event.component === 'partition') return ['partition-p0', 'partition-p1', 'partition-p2']
    if (context.event.component === 'consumer') return ['consumer-c1', 'consumer-c2', 'consumer-c3']
  }

  if (context.experimentId === 'join-leave-rebalance') {
    if (context.sequence === 0) return ['consumer-c1', 'partition-p1']
    if (context.sequence <= 2) return ['coordinator', 'consumer-c1', 'partition-p1']
    return ['consumer-c2', 'partition-p1']
  }

  if (context.experimentId === 'poll-timeout') {
    if (context.event.component === 'application') return ['application', 'consumer-c1']
    if (context.event.component === 'partition') return ['partition-p1', 'consumer-c1']
    return ['consumer-c1', COMPONENT_FOCUS[context.event.component]]
  }

  return [COMPONENT_FOCUS[context.event.component]]
}

function chapter7Focus(context: CityCueContext): AdvancedNodeId[] {
  if (context.experimentId === 'staged-backoff') {
    if (context.sequence === 2 || context.sequence === 3) return ['retry-1m', 'application']
    if (context.sequence >= 4) return ['retry-10m', 'application']
  }

  if (context.experimentId === 'dead-letter-evidence') {
    if (context.sequence >= 1) return ['dlt', 'application']
    return ['retry-loop', 'application']
  }

  if (context.event.component === 'partition') return ['partition-p0', 'retry-loop']
  if (context.event.component === 'retry') return ['retry-loop', 'consumer-c1']
  return [COMPONENT_FOCUS[context.event.component]]
}

function chapter8Focus(context: CityCueContext): AdvancedNodeId[] {
  if (context.experimentId === 'isolation-visibility') {
    if (context.event.component === 'offset') return ['offset-store', 'transaction-coordinator']
    if (context.event.component === 'consumer') return ['consumer-c1', 'transaction-coordinator']
  }

  if (context.event.component === 'offset') return ['offset-store', 'transaction-coordinator']
  if (context.event.component === 'producer') return ['producer', 'transaction-coordinator']
  if (context.event.component === 'application') return ['application', 'offset-store']
  return [COMPONENT_FOCUS[context.event.component]]
}

function nodeChangesFor(context: CityCueContext): NonNullable<ChapterCityCue['nodeChanges']> {
  if (context.chapterId === 6) return chapter6NodeChanges(context)
  if (context.chapterId === 7) return chapter7NodeChanges(context)
  return chapter8NodeChanges(context)
}

function chapter6NodeChanges(context: CityCueContext): NonNullable<ChapterCityCue['nodeChanges']> {
  if (context.experimentId === 'assignment-capacity') {
    const activeOwners = {
      'partition-p0': { state: 'active', badge: 'c1' },
      'partition-p1': { state: 'active', badge: 'c2' },
      'partition-p2': { state: 'active', badge: 'c3' },
      'consumer-c1': { state: context.outcomeStatus === 'succeeded' ? 'complete' : 'active', badge: 'p0' },
      'consumer-c2': { state: context.outcomeStatus === 'succeeded' ? 'complete' : 'active', badge: 'p1' },
      'consumer-c3': { state: context.outcomeStatus === 'succeeded' ? 'complete' : 'active', badge: 'p2' },
    } as const
    return context.choiceId === 'add-consumers-only'
      ? {
          ...activeOwners,
          'consumer-c4': { state: 'idle', badge: 'idle' },
          'consumer-c5': { state: 'idle', badge: 'idle' },
        }
      : activeOwners
  }

  if (context.experimentId === 'join-leave-rebalance') {
    if (context.choiceId === 'ignore-ownership-boundary') {
      return {
        'consumer-c1': { state: context.sequence >= 3 ? 'failed' : 'active', badge: 'old p1' },
        'consumer-c2': { state: context.sequence >= 2 ? 'blocked' : 'idle', badge: context.sequence >= 2 ? 'new p1' : 'idle' },
        'partition-p1': { state: context.sequence >= 2 ? 'blocked' : 'active', badge: 'p1' },
        'offset-store': { state: context.sequence >= 3 ? 'failed' : 'idle' },
      }
    }
    return {
      'consumer-c1': { state: context.sequence >= 2 ? 'muted' : 'active', badge: context.sequence >= 2 ? 'revoked' : 'p1' },
      'consumer-c2': { state: context.sequence >= 3 ? 'complete' : 'idle', badge: context.sequence >= 3 ? 'p1' : 'idle' },
      'partition-p1': { state: context.sequence >= 3 ? 'complete' : 'active', badge: context.sequence >= 3 ? 'c2' : 'c1' },
      'offset-store': { state: context.sequence >= 2 ? 'active' : 'idle', badge: context.sequence >= 2 ? '41' : null },
    }
  }

  if (context.experimentId === 'poll-timeout') {
    const failed = context.choiceId === 'block-poll-past-interval' && context.sequence >= 2
    return {
      'consumer-c1': { state: failed ? 'failed' : context.outcomeStatus === 'succeeded' && context.sequence >= 3 ? 'complete' : 'active', badge: 'p1' },
      'coordinator': { state: failed ? 'blocked' : 'active' },
      'partition-p1': { state: failed ? 'failed' : 'active', badge: failed ? 'revoked' : 'c1' },
      'offset-store': { state: context.sequence >= 2 ? 'active' : 'idle' },
    }
  }

  return {}
}

function chapter7NodeChanges(context: CityCueContext): NonNullable<ChapterCityCue['nodeChanges']> {
  if (context.experimentId === 'blocking-retry') {
    return {
      'partition-p0': { state: context.choiceId === 'retry-in-place-unbounded' && context.sequence >= 3 ? 'blocked' : 'active', badge: '17' },
      'retry-loop': { state: context.choiceId === 'retry-in-place-unbounded' ? 'blocked' : context.sequence >= 4 ? 'complete' : 'active', badge: context.choiceId === 'retry-in-place-unbounded' ? 'loop' : '3x' },
      application: { state: context.sequence === 1 && context.choiceId === 'retry-in-place-unbounded' ? 'failed' : 'active' },
    }
  }

  if (context.experimentId === 'staged-backoff') {
    return {
      application: { state: context.outcomeStatus === 'succeeded' && context.sequence >= 5 ? 'complete' : 'active' },
      'retry-loop': { state: context.choiceId === 'assume-broker-auto-retry-topics' ? 'failed' : 'muted', badge: context.choiceId === 'assume-broker-auto-retry-topics' ? 'missing' : null },
      'retry-1m': { state: context.sequence >= 2 ? 'active' : 'idle', badge: context.sequence >= 2 ? '1m' : null },
      'retry-10m': { state: context.sequence >= 4 ? (context.sequence >= 5 ? 'complete' : 'active') : 'idle', badge: context.sequence >= 4 ? '10m' : null },
    }
  }

  if (context.experimentId === 'dead-letter-evidence') {
    return {
      'retry-loop': { state: context.sequence === 0 ? 'failed' : 'muted', badge: '3x' },
      dlt: { state: context.outcomeStatus === 'succeeded' && context.sequence >= 4 ? 'complete' : context.sequence >= 1 ? 'active' : 'idle', badge: context.choiceId === 'publish-dlt-with-context' ? 'manifest' : 'payload' },
      application: { state: context.choiceId === 'publish-payload-only' && context.sequence >= 3 ? 'failed' : 'active' },
      'offset-store': { state: context.sequence >= 3 ? 'active' : 'idle' },
    }
  }

  return {}
}

function chapter8NodeChanges(context: CityCueContext): NonNullable<ChapterCityCue['nodeChanges']> {
  const boundaryState = context.event.kind === 'experiment.succeeded' ? 'complete' : context.event.state
  if (context.experimentId === 'isolation-visibility') {
    return {
      'transaction-coordinator': { state: context.sequence >= 3 ? boundaryState : 'active', badge: context.choiceId === 'read-committed-to-lso' ? 'LSO' : 'open' },
      'offset-store': { state: context.sequence >= 2 ? (context.choiceId === 'read-committed-to-lso' ? 'blocked' : 'active') : 'idle', badge: context.sequence >= 2 ? 'LSO' : null },
      'consumer-c1': { state: context.choiceId === 'read-uncommitted-results' && context.sequence >= 4 ? 'failed' : context.event.kind === 'experiment.succeeded' ? 'complete' : 'active' },
      application: { state: context.choiceId === 'read-uncommitted-results' && context.sequence >= 4 ? 'failed' : 'idle' },
    }
  }

  return {
    'transaction-coordinator': { state: boundaryState, badge: context.event.kind === 'experiment.failed' ? 'split' : 'tx' },
    producer: { state: context.sequence >= 2 ? 'active' : 'idle' },
    'offset-store': { state: context.sequence >= 3 ? (context.event.kind === 'experiment.failed' ? 'failed' : 'active') : 'idle', badge: context.sequence >= 3 ? 'offset' : null },
    application: { state: context.event.component === 'application' ? context.event.state : 'active' },
  }
}

function routeFor(context: CityCueContext): string | null {
  if (context.chapterId === 6) return chapter6Route(context)
  if (context.chapterId === 7) return chapter7Route(context)
  return chapter8Route(context)
}

function chapter6Route(context: CityCueContext): string | null {
  if (context.experimentId === 'assignment-capacity') {
    if (context.sequence === 1) return 'coordinator-c1'
    if (context.sequence >= 2 && context.choiceId === 'add-consumers-only') return 'coordinator-c4'
    if (context.sequence >= 2) return 'p1-c2'
  }
  if (context.experimentId === 'join-leave-rebalance') {
    if (context.sequence <= 1) return 'p1-c2'
    if (context.sequence === 2) return 'coordinator-c1'
    return 'coordinator-c2'
  }
  if (context.experimentId === 'poll-timeout') {
    if (context.event.component === 'offset') return 'c1-offset'
    if (context.event.component === 'application') return 'c1-application'
    return 'p1-c1'
  }
  return null
}

function chapter7Route(context: CityCueContext): string | null {
  if (context.experimentId === 'blocking-retry') {
    if (context.event.component === 'application') return 'consumer-application'
    if (context.event.component === 'partition') return 'p0-consumer'
    return 'application-retry-loop'
  }
  if (context.experimentId === 'staged-backoff') {
    if (context.sequence <= 1) return 'consumer-application'
    if (context.sequence === 2) return 'application-retry-1m'
    if (context.sequence === 3) return 'application-retry-1m'
    if (context.sequence === 4) return 'retry-1m-retry-10m'
    return 'retry-10m-application'
  }
  if (context.experimentId === 'dead-letter-evidence') {
    if (context.sequence >= 2) return 'application-dlt'
    if (context.sequence === 1) return 'application-dlt'
    return 'application-retry-loop'
  }
  return null
}

function chapter8Route(context: CityCueContext): string | null {
  if (context.experimentId === 'isolation-visibility') {
    if (context.event.component === 'consumer') return 'transaction-consumer-result'
    if (context.event.component === 'offset') return 'transaction-offset'
    return 'transaction-application'
  }
  if (context.event.component === 'consumer') return 'consumer-application'
  if (context.event.component === 'producer') return 'application-producer'
  if (context.event.component === 'offset') return 'application-offset'
  if (context.event.component === 'application') return 'application-offset'
  return 'transaction-application'
}

function routeChangeFor(
  context: CityCueContext,
  failedTerminal: boolean,
  successTerminal: boolean,
): CityRouteChange {
  return {
    state: failedTerminal ? 'failed' : successTerminal ? 'complete' : context.event.state,
    disabled: failedTerminal && context.outcomeStatus === 'failed',
  }
}

function carrierChangesFor(
  context: CityCueContext,
  routeId: string | null,
): Readonly<Record<string, CityCarrierChange | null>> | undefined {
  if (!routeId) return undefined

  if (
    routeId.includes('coordinator')
    || routeId.includes('transaction')
    || routeId === 'offset-consumer-commit'
  ) {
    return undefined
  }

  if (context.event.kind === 'experiment.failed') {
    return {
      active: { kind: 'ghost-record', routeId, checkpointId: `${routeId}:mid`, progress: 0.72, state: 'failed', label: context.event.title },
    }
  }

  if (context.event.component === 'offset' || routeId.includes('offset')) {
    return {
      offset: { kind: 'offset-ticket', routeId, checkpointId: `${routeId}:mid`, progress: 0.64, state: context.event.state, label: context.event.title },
    }
  }

  if (context.chapterId === 7 && context.experimentId === 'dead-letter-evidence' && context.sequence >= 1) {
    return {
      manifest: { kind: 'retry-record', routeId, checkpointId: `${routeId}:mid`, progress: 0.68, state: context.event.state, label: context.choiceId === 'publish-dlt-with-context' ? 'DLT manifest' : 'DLT payload' },
    }
  }

  if (context.chapterId === 7 && routeId.includes('retry')) {
    return {
      retry: { kind: 'retry-record', routeId, checkpointId: `${routeId}:mid`, progress: 0.58, state: context.event.state, label: context.event.title },
    }
  }

  return {
    active: { kind: 'record', routeId, checkpointId: `${routeId}:mid`, progress: 0.52, state: context.event.state, label: context.event.title },
  }
}

function optionalCarrierChanges(
  context: CityCueContext,
  routeId: string | null,
): { carrierChanges: Readonly<Record<string, CityCarrierChange | null>> } | Record<string, never> {
  const carrierChanges = carrierChangesFor(context, routeId)
  return carrierChanges ? { carrierChanges } : {}
}

function signalFor(context: CityCueContext): CitySignalCue | null {
  if (context.chapterId === 6) {
    if (context.experimentId === 'join-leave-rebalance' && context.sequence === 2) {
      return { kind: 'revocation', fromNodeId: 'coordinator', toNodeId: 'consumer-c1', state: context.event.state, label: 'p1 revocation' }
    }
    if (context.event.kind === 'experiment.succeeded') {
      return {
        kind: 'assignment',
        fromNodeId: 'coordinator',
        toNodeId: context.experimentId === 'join-leave-rebalance' ? 'consumer-c2' : 'consumer-c1',
        state: 'complete',
        label: 'assignment accepted',
      }
    }
  }

  if (context.chapterId === 7 && context.event.kind === 'experiment.succeeded') {
    return { kind: 'commit', fromNodeId: 'offset-store', toNodeId: 'consumer-c1', state: 'complete', label: 'offset policy committed' }
  }

  if (context.chapterId === 8) {
    if (context.event.kind === 'experiment.succeeded') {
      return { kind: 'tx-commit', fromNodeId: 'transaction-coordinator', toNodeId: 'offset-store', state: 'complete', label: 'transaction committed' }
    }
    if (context.event.kind === 'experiment.failed' || (context.experimentId === 'transactional-repair' && context.sequence === 4)) {
      return { kind: 'tx-abort', fromNodeId: 'transaction-coordinator', toNodeId: 'application', state: context.event.kind === 'experiment.failed' ? 'failed' : 'blocked', label: 'transaction aborted' }
    }
  }

  return null
}

function barrierFor(
  context: CityCueContext,
  nodeId: string,
  routeId: string | null,
  terminal: boolean,
): CityBarrierCue | null {
  if (context.event.kind === 'experiment.failed') {
    return {
      state: 'closed',
      label: context.event.title,
      nodeId,
      ...(routeId ? { routeId, checkpointId: `${routeId}:mid` } : {}),
    }
  }

  if (context.chapterId === 8 && context.experimentId === 'isolation-visibility' && context.choiceId === 'read-committed-to-lso' && context.sequence === 2) {
    return { state: 'closed', label: 'Last Stable Offset boundary', nodeId: 'offset-store', routeId: 'transaction-offset', checkpointId: 'transaction-offset:mid' }
  }

  if (terminal) {
    return {
      state: 'open',
      label: context.event.title,
      nodeId,
      ...(routeId ? { routeId } : {}),
    }
  }
  return null
}
