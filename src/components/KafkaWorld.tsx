import type {
  ComponentId,
  ComponentState,
  SimulationEvent,
  SimulationRun,
} from '../domain/simulation'

import styles from './KafkaWorld.module.css'

interface KafkaWorldProps {
  run: SimulationRun | null
  activeEvent: SimulationEvent | null
  reducedMotion: boolean
  focusedSetting: string | null
  onInspect: (component: ComponentId) => void
}

function stateFor(
  component: ComponentId,
  run: SimulationRun | null,
  cursor: number,
): ComponentState {
  if (!run || cursor < 0) return 'idle'
  const visibleEvents = run.events.slice(0, cursor + 1)
  const latest = visibleEvents.filter((event) => event.component === component).at(-1)
  if (latest) return latest.state
  if (run.status === 'failed' && component === 'rail') return 'blocked'
  return 'idle'
}

function statusText(state: ComponentState): string {
  const labels: Record<ComponentState, string> = {
    idle: '대기',
    active: '처리 중',
    blocked: '차단',
    failed: '실패',
    complete: '완료',
  }
  return labels[state]
}

export function KafkaWorld({
  run,
  activeEvent,
  reducedMotion,
  focusedSetting,
  onInspect,
}: KafkaWorldProps) {
  const cursor = activeEvent?.sequence ?? -1
  const producerState = stateFor('producer', run, cursor)
  const serializerState = stateFor('serializer', run, cursor)
  const railState = stateFor('rail', run, cursor)
  const brokerState = stateFor('broker', run, cursor)
  const ackState = stateFor('ack', run, cursor)
  const serializerFocused = focusedSetting === 'serializer'
  const ackFocused = focusedSetting === 'acks'

  const inspect = (component: ComponentId) => () => onInspect(component)
  const inspectWithKeyboard = (component: ComponentId) => (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onInspect(component)
    }
  }

  return (
    <svg
      className={`${styles.world} ${reducedMotion ? styles.reduced : ''}`}
      viewBox="0 0 900 510"
      role="img"
      aria-labelledby="world-title world-description"
    >
      <title id="world-title">Kafka 메시지 물류 도시</title>
      <desc id="world-description">
        Producer에서 Serializer 게이트를 거쳐 Broker 창고까지 메시지가 이동하고 ACK가 돌아오는 경로입니다.
      </desc>
      <defs>
        <pattern id="iso-grid" width="64" height="32" patternUnits="userSpaceOnUse">
          <path d="M0 16 32 0l32 16-32 16z" fill="none" stroke="#19314c" strokeWidth="1" />
        </pattern>
        <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="pixel-shadow" x="-30%" y="-30%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="0" floodColor="#030912" floodOpacity=".65" />
        </filter>
        <marker id="arrow-cyan" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="#42e8e0" />
        </marker>
      </defs>

      <rect width="900" height="510" rx="20" fill="#081524" />
      <rect y="124" width="900" height="386" fill="url(#iso-grid)" opacity=".68" />
      <path d="M0 125h900" stroke="#284762" strokeWidth="2" />
      <text x="28" y="42" className={styles.eyebrow}>KAFKA DISTRICT / PARTITION 0</text>
      <text x="28" y="70" className={styles.caption}>
        logical time {activeEvent ? `${activeEvent.atMs}ms` : '—'} · event {activeEvent ? activeEvent.sequence + 1 : 0}/{run?.events.length ?? 0}
      </text>

      <g className={`${styles.rail} ${styles[railState]}`}>
        <path d="M210 321 368 242 644 380" fill="none" stroke="#1a2c42" strokeWidth="32" strokeLinecap="square" />
        <path d="M210 321 368 242 644 380" fill="none" stroke="#31506c" strokeWidth="5" strokeDasharray="14 10" />
        {railState === 'active' && (
          <path
            d="M210 321 368 242 644 380"
            fill="none"
            stroke="#42e8e0"
            strokeWidth="5"
            strokeDasharray="8 16"
            markerEnd="url(#arrow-cyan)"
            className={styles.pulseRail}
          />
        )}
        {railState === 'blocked' && (
          <g transform="translate(482 286)">
            <path d="M-18-18 18 18M18-18-18 18" stroke="#ff6577" strokeWidth="9" />
            <circle r="29" fill="none" stroke="#ff6577" strokeWidth="4" />
          </g>
        )}
      </g>

      <g
        role="button"
        tabIndex={0}
        aria-label={`Producer Station, ${statusText(producerState)}`}
        onClick={inspect('producer')}
        onKeyDown={inspectWithKeyboard('producer')}
        className={`${styles.station} ${styles[producerState]}`}
        transform="translate(72 212)"
      >
        <path d="M14 66 90 28l94 47-78 39z" fill="#1d3954" />
        <path d="M14 66v78l92 46v-76z" fill="#10253b" />
        <path d="M106 114v76l78-39V75z" fill="#0b1b2d" />
        <path d="m48 56 55-28 48 24-56 28z" fill="#2c5875" stroke="#4f7895" strokeWidth="3" />
        <path d="M48 56v52l47 24V80z" fill="#1b405c" />
        <path d="M95 80v52l56-28V52z" fill="#153049" />
        <rect x="68" y="72" width="12" height="12" fill="#42e8e0" className={styles.signal} />
        <rect x="50" y="122" width="34" height="28" fill="#07111f" stroke="#31506c" strokeWidth="3" />
        <text x="99" y="216" textAnchor="middle" className={styles.label}>PRODUCER</text>
        <text x="99" y="235" textAnchor="middle" className={styles.stateLabel}>{statusText(producerState)}</text>
      </g>

      <g
        role="button"
        tabIndex={0}
        aria-label={`Serializer Gate, ${statusText(serializerState)}`}
        onClick={inspect('serializer')}
        onKeyDown={inspectWithKeyboard('serializer')}
        className={`${styles.station} ${styles[serializerState]} ${serializerFocused ? styles.focused : ''}`}
        transform="translate(314 154)"
      >
        <path d="m12 76 66-34 80 40-68 34z" fill="#253c5a" filter="url(#pixel-shadow)" />
        <path d="M30 70v100h23V82zm94 7v95h23V89z" fill="#172a45" stroke="#456481" strokeWidth="3" />
        <path d="M30 71 78 47l69 35-23 12-47-23-24 12z" fill="#37577a" />
        <path d="M54 98h68v16H54zM54 132h68v16H54z" fill="#0b1729" stroke="#4b6c8d" strokeWidth="3" />
        {serializerState === 'failed' ? (
          <path d="M68 101 108 141M108 101 68 141" stroke="#ff6577" strokeWidth="9" filter="url(#soft-glow)" />
        ) : (
          <path d="m72 123 14 14 28-34" fill="none" stroke="#42e8e0" strokeWidth="7" className={styles.signal} />
        )}
        <text x="88" y="199" textAnchor="middle" className={styles.label}>SERIALIZER GATE</text>
        <text x="88" y="218" textAnchor="middle" className={styles.stateLabel}>{statusText(serializerState)}</text>
      </g>

      <g
        role="button"
        tabIndex={0}
        aria-label={`Broker Warehouse, ${statusText(brokerState)}`}
        onClick={inspect('broker')}
        onKeyDown={inspectWithKeyboard('broker')}
        className={`${styles.station} ${styles[brokerState]}`}
        transform="translate(622 222)"
      >
        <path d="m4 88 105-54 126 63-108 54z" fill="#25445f" filter="url(#pixel-shadow)" />
        <path d="M4 88v112l123 61V151z" fill="#17324b" />
        <path d="M127 151v110l108-54V97z" fill="#0e2236" />
        <path d="m36 71 72-37 93 46-74 38z" fill="#386883" stroke="#5d89a1" strokeWidth="3" />
        <path d="M54 124h51v65H54z" fill="#091522" stroke="#456a84" strokeWidth="4" />
        <path d="M66 142h27M66 158h27M66 174h27" stroke="#65e69d" strokeWidth="5" className={styles.signal} />
        <path d="m153 133 49-25v23l-49 25zm0 38 49-25v23l-49 25z" fill="#1d3f5b" stroke="#456a84" strokeWidth="3" />
        <text x="119" y="289" textAnchor="middle" className={styles.label}>BROKER-1 / LEADER</text>
        <text x="119" y="308" textAnchor="middle" className={styles.stateLabel}>{statusText(brokerState)}</text>
      </g>

      {activeEvent && activeEvent.sequence >= 0 && activeEvent.kind !== 'ack.returned' && (
        <g className={`${styles.crate} ${styles[`crate${activeEvent.component}`]}`} aria-hidden="true">
          <path d="m-22-8 26-13 28 14L6 6z" fill="#ffd77d" stroke="#5d421b" strokeWidth="3" />
          <path d="M-22-8v28L6 34V6z" fill="#d99532" stroke="#5d421b" strokeWidth="3" />
          <path d="M6 6v28l26-13V-7z" fill="#af6a22" stroke="#5d421b" strokeWidth="3" />
          <path d="M-6-15 20-2" stroke="#fff0b5" strokeWidth="4" />
          <text x="5" y="54" textAnchor="middle" className={styles.crateLabel}>{run?.messageId}</text>
        </g>
      )}

      {(ackState === 'active' || ackState === 'complete') && (
        <g
          role="button"
          tabIndex={0}
          aria-label={`ACK Drone, ${statusText(ackState)}`}
          onClick={inspect('ack')}
          onKeyDown={inspectWithKeyboard('ack')}
          className={`${styles.ackDrone} ${ackFocused ? styles.focused : ''}`}
          transform="translate(544 172)"
        >
          <path d="M-38 0h76M0-22v44" stroke="#65e69d" strokeWidth="6" />
          <rect x="-20" y="-14" width="40" height="28" rx="4" fill="#173f39" stroke="#65e69d" strokeWidth="3" />
          <circle cx="-39" r="12" fill="none" stroke="#65e69d" strokeWidth="4" />
          <circle cx="39" r="12" fill="none" stroke="#65e69d" strokeWidth="4" />
          <text y="5" textAnchor="middle" className={styles.ackText}>ACK</text>
        </g>
      )}

      <g transform="translate(28 450)">
        <rect width="360" height="40" rx="8" fill="#0b1729" stroke="#294560" />
        <circle cx="22" cy="20" r="7" fill={run?.status === 'failed' ? '#ff6577' : run?.status === 'succeeded' ? '#65e69d' : '#60758d'} />
        <text x="40" y="25" className={styles.caption}>
          {activeEvent?.title ?? '메시지 발송을 기다리는 중'}
        </text>
      </g>
    </svg>
  )
}
