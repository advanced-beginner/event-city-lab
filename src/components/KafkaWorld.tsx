import type { CSSProperties, KeyboardEvent } from 'react'

import type {
  ComponentId,
  ComponentState,
  SimulationEvent,
  SimulationRun,
} from '../domain/simulation'
import cityBackground from '../assets/city/background/event-city-main.webp'

import { CitySprite } from './CitySprite'
import styles from './KafkaWorld.module.css'

interface KafkaWorldProps {
  run: SimulationRun | null
  activeEvent: SimulationEvent | null
  cursor: number
  attempt: number
  reducedMotion: boolean
  focusedSetting: string | null
  pendingRerun: boolean
  onInspect: (component: ComponentId) => void
}

function stateFor(component: ComponentId, run: SimulationRun | null, cursor: number): ComponentState {
  if (!run || cursor < 0) return 'idle'
  const latest = run.events.slice(0, cursor + 1).filter((event) => event.component === component).at(-1)
  if (latest) return latest.state
  if (run.status === 'failed' && component === 'rail') return 'blocked'
  return 'idle'
}

function statusText(state: ComponentState): string {
  return { idle: '대기', active: '처리 중', blocked: '차단', failed: '실패', complete: '완료' }[state]
}

function vehiclePosition(activeEvent: SimulationEvent | null): [number, number, number] {
  if (!activeEvent) return [360, 472, 0]
  if (activeEvent.kind === 'command.accepted' || activeEvent.kind === 'producer.preparing') return [392, 454, 0]
  if (activeEvent.kind === 'serializer.inspecting') return [510, 407, 0]
  if (activeEvent.kind === 'serializer.rejected') return [530, 397, 0]
  if (activeEvent.kind === 'serializer.completed') return [552, 386, 0]
  if (activeEvent.kind === 'network.dispatched') return [646, 342, 0]
  return [730, 304, 0]
}

export function KafkaWorld({
  run,
  activeEvent,
  cursor,
  attempt,
  reducedMotion,
  focusedSetting,
  pendingRerun,
  onInspect,
}: KafkaWorldProps) {
  const producerState = stateFor('producer', run, cursor)
  const serializerState = stateFor('serializer', run, cursor)
  const railState = stateFor('rail', run, cursor)
  const brokerState = stateFor('broker', run, cursor)
  const ackState = stateFor('ack', run, cursor)
  const serializerFocused = focusedSetting === 'serializer'
  const ackFocused = focusedSetting === 'acks'
  const isFailure = serializerState === 'failed' || pendingRerun
  const ackVisible = ackState === 'active' || ackState === 'complete'
  const [vehicleX, vehicleY, vehicleAngle] = vehiclePosition(activeEvent)
  const vehicleStyle = {
    '--vehicle-x': `${vehicleX}px`,
    '--vehicle-y': `${vehicleY}px`,
    '--vehicle-angle': `${vehicleAngle}deg`,
  } as CSSProperties

  const inspect = (component: ComponentId) => () => onInspect(component)
  const inspectWithKeyboard = (component: ComponentId) => (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onInspect(component)
    }
  }

  return (
    <svg className={`${styles.world} ${reducedMotion ? styles.reduced : ''}`} viewBox="0 0 1000 610" role="img" aria-labelledby="world-title world-description" preserveAspectRatio="xMidYMid meet">
      <title id="world-title">Kafka 메시지 배송 도시</title>
      <desc id="world-description">노란 배송 차량이 Producer 출발센터에서 Serializer 검사소를 거쳐 Broker 기록센터까지 이동하고, 기록 완료 후 Producer에 도착 문자가 전송됩니다.</desc>
      <defs>
        <filter id="city-shadow" x="-40%" y="-40%" width="200%" height="220%"><feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#53616a" floodOpacity=".2" /></filter>
        <filter id="focus-glow" x="-40%" y="-40%" width="190%" height="190%"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#7656c9" floodOpacity=".7" /></filter>
        <marker id="signal-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10z" fill="#238a5b" /></marker>
      </defs>

      <image className={styles.cityBackdrop} href={cityBackground} width="1000" height="610" preserveAspectRatio="xMidYMid slice" aria-hidden="true" />
      <rect className={styles.backdropWash} width="1000" height="610" aria-hidden="true" />

      <g className={styles.route} aria-hidden="true">
        <path d="M360 472C438 438 493 419 552 386S662 332 730 304" fill="none" stroke="#ffffff" strokeWidth="8" opacity=".72" />
        <path d="M360 472C438 438 493 419 552 386S662 332 730 304" fill="none" stroke={isFailure ? '#aab2ad' : '#008e91'} strokeWidth="4" strokeDasharray="10 11" className={railState === 'active' ? styles.routeActive : ''} />
        {isFailure && <path d="M552 386C614 354 672 326 730 304" fill="none" stroke="#d5d9d7" strokeWidth="5" strokeDasharray="7 12" />}
      </g>

      <g role="button" tabIndex={0} aria-label={`Producer 출발센터, ${statusText(producerState)}`} onClick={inspect('producer')} onKeyDown={inspectWithKeyboard('producer')} className={`${styles.facility} ${styles[producerState]}`}>
        <path className={styles.facilityHitArea} d="M207 109 358 118 405 413 331 474 239 443 207 318Z" />
        <g className={styles.facilitySign} transform="translate(230 390)"><rect width="174" height="28" rx="6" /><circle cx="16" cy="14" r="6" className={styles.stateLamp} data-state={producerState} /><text x="96" y="18" textAnchor="middle">1 · 출발센터 · {statusText(producerState)}</text></g>
      </g>

      <g role="button" tabIndex={0} aria-label={`Serializer 검사소, ${statusText(serializerState)}`} onClick={inspect('serializer')} onKeyDown={inspectWithKeyboard('serializer')} className={`${styles.facility} ${styles[serializerState]} ${serializerFocused ? styles.focused : ''}`}>
        <path className={styles.facilityHitArea} d="M414 68 563 68 607 324 566 388 447 370 414 251Z" />
        {isFailure && <g className={styles.errorSign} transform="translate(424 318)"><rect width="186" height="28" rx="6" /><text x="93" y="18" textAnchor="middle">2 · OrderEvent ≠ StringSerializer</text></g>}
        {!isFailure && <g className={styles.facilitySign} transform="translate(430 331)"><rect width="174" height="28" rx="6" /><circle cx="16" cy="14" r="6" className={styles.stateLamp} data-state={serializerState} /><text x="96" y="18" textAnchor="middle">2 · 검사소 · {statusText(serializerState)}</text></g>}
      </g>

      <g role="button" tabIndex={0} aria-label={`Broker 기록센터, ${statusText(brokerState)}`} onClick={inspect('broker')} onKeyDown={inspectWithKeyboard('broker')} className={`${styles.facility} ${styles[brokerState]}`}>
        <path className={styles.facilityHitArea} d="M568 21 785 16 842 239 760 315 642 300 578 220Z" />
        <g className={styles.facilitySign} transform="translate(641 247)"><rect width="174" height="28" rx="6" /><circle cx="16" cy="14" r="6" className={styles.stateLamp} data-state={brokerState} /><text x="96" y="18" textAnchor="middle">3 · 기록센터 · {statusText(brokerState)}</text></g>
      </g>

      <g className={`${styles.vehicle} ${isFailure ? styles.vehicleFailed : ''}`} style={vehicleStyle} aria-hidden="true">
        <CitySprite id="vehicle-kafka-van-northeast" x={4} y={40} scale={0.38} />
        <g className={styles.cargoTag} transform="translate(-38 -21)"><rect width="73" height="16" /><text x="36.5" y="11" textAnchor="middle">order-2401 · #{attempt}</text></g>
      </g>

      {ackVisible && (
        <g role="button" tabIndex={0} aria-label={`Producer 도착 문자, ${statusText(ackState)}`} onClick={inspect('ack')} onKeyDown={inspectWithKeyboard('ack')} className={`${styles.ackSignal} ${ackFocused ? styles.focused : ''}`}>
          <path d="M720 274C640 78 400 42 318 255" fill="none" stroke="#238a5b" strokeWidth="4" strokeDasharray="9 10" markerEnd="url(#signal-arrow)" />
          <circle cx="621" cy="128" r="8" fill="#e8f7ef" stroke="#238a5b" strokeWidth="3" />
          <circle cx="482" cy="86" r="8" fill="#e8f7ef" stroke="#238a5b" strokeWidth="3" />
          <g className={styles.smsBubble} transform="translate(20 92)">
            <rect width="286" height="78" rx="12" />
            <path d="m54 78-16 20 4-20" />
            <circle cx="24" cy="24" r="12" fill="#238a5b" />
            <path d="m18 24 4 4 8-9" fill="none" stroke="white" strokeWidth="3" />
            <text x="44" y="24" className={styles.smsTitle}>기록 완료 문자가 도착했습니다</text>
            <text x="18" y="49" className={styles.smsText}>orders.v1 / partition 0 / offset 42 저장 완료</text>
            <text x="18" y="66" className={styles.smsText}>acks=all · broker-1</text>
          </g>
        </g>
      )}

      <g className={styles.cityLabel} transform="translate(24 28)" aria-hidden="true">
        <rect width="198" height="46" rx="10" />
        <text x="14" y="20">EVENT CITY · BUILDING MAP</text>
        <text x="14" y="35">orders.v1 · partition 0</text>
      </g>
    </svg>
  )
}
