import type { CSSProperties, KeyboardEvent } from 'react'

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
  cursor: number
  attempt: number
  reducedMotion: boolean
  focusedSetting: string | null
  pendingRerun: boolean
  onInspect: (component: ComponentId) => void
}

interface BuildingProps {
  x: number
  y: number
  scale?: number
  roof: string
  left: string
  right: string
  compact?: boolean
  wide?: boolean
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

function SmallBuilding({ x, y, scale = 1, roof, left, right, compact, wide }: BuildingProps) {
  const densityClass = wide ? styles.wideOnly : compact ? styles.standardOnly : ''
  return (
    <g className={`${styles.decorBuilding} ${densityClass}`} transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <path d="m0 24 42-22 48 24-43 22z" fill={roof} />
      <path d="M0 24v52l47 24V48z" fill={left} />
      <path d="M47 48v52l43-22V26z" fill={right} />
      <path d="M10 43v11l9 5V48zm17 9v11l9 5V57z" fill="#eaf7f7" opacity=".85" />
      <path d="m58 54 20-10v11L58 65zm0 19 20-10v11L58 84z" fill="#eef7fa" opacity=".76" />
    </g>
  )
}

function Tree({ x, y, wide }: { x: number; y: number; wide?: boolean }) {
  return (
    <g className={`${styles.tree} ${wide ? styles.wideOnly : ''}`} transform={`translate(${x} ${y})`} aria-hidden="true">
      <path d="M0 11v17" stroke="#8c6944" strokeWidth="4" />
      <circle cy="2" r="12" fill="#68b879" />
      <circle cx="-7" cy="9" r="9" fill="#54a96b" />
      <circle cx="7" cy="9" r="9" fill="#76c88a" />
    </g>
  )
}

function vehiclePosition(activeEvent: SimulationEvent | null): [number, number, number] {
  if (!activeEvent) return [245, 421, 0]
  if (activeEvent.kind === 'command.accepted' || activeEvent.kind === 'producer.preparing') return [278, 414, -3]
  if (activeEvent.kind === 'serializer.inspecting') return [430, 371, -8]
  if (activeEvent.kind === 'serializer.rejected') return [447, 365, -8]
  if (activeEvent.kind === 'serializer.completed') return [492, 354, -8]
  if (activeEvent.kind === 'network.dispatched') return [610, 322, -8]
  return [777, 276, -8]
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
        <linearGradient id="world-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f9fbf6" /><stop offset="1" stopColor="#e7efe2" /></linearGradient>
        <linearGradient id="road" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d4d0c5" /><stop offset="1" stopColor="#c5c2b9" /></linearGradient>
        <filter id="city-shadow" x="-40%" y="-40%" width="200%" height="220%"><feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#53616a" floodOpacity=".2" /></filter>
        <filter id="focus-glow" x="-40%" y="-40%" width="190%" height="190%"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#7656c9" floodOpacity=".7" /></filter>
        <marker id="signal-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 10 5 0 10z" fill="#238a5b" /></marker>
      </defs>

      <rect width="1000" height="610" fill="url(#world-sky)" />
      <path d="M0 125 510 0h490v610H0z" fill="#edf4e8" />
      <path d="M-90 544 322 437 486 382 1080 225" fill="none" stroke="#b9b6ad" strokeWidth="112" opacity=".55" />
      <path d="M-90 533 322 426 486 371 1080 214" fill="none" stroke="url(#road)" strokeWidth="98" />
      <path d="M-90 533 322 426 486 371 1080 214" fill="none" stroke="#f8f5e9" strokeWidth="3" strokeDasharray="26 18" />
      <path d="M130 610 370 421 577 0" fill="none" stroke="#d5d1c6" strokeWidth="62" />
      <path d="M130 610 370 421 577 0" fill="none" stroke="#f8f5e9" strokeWidth="2" strokeDasharray="20 15" />
      <path d="M690 610 676 322 870 0" fill="none" stroke="#d5d1c6" strokeWidth="55" />
      <path d="M690 610 676 322 870 0" fill="none" stroke="#f8f5e9" strokeWidth="2" strokeDasharray="20 15" />

      <g className={styles.route} aria-hidden="true">
        <path d="M248 432 444 375 510 357 784 284" fill="none" stroke="#65736e" strokeWidth="10" opacity=".25" />
        <path d="M248 432 444 375 510 357 784 284" fill="none" stroke={isFailure ? '#aab2ad' : '#0e9da0'} strokeWidth="5" strokeDasharray="11 10" className={railState === 'active' ? styles.routeActive : ''} />
        {isFailure && <path d="M500 359 784 284" fill="none" stroke="#c2c6c2" strokeWidth="6" strokeDasharray="7 12" />}
      </g>

      <g className={styles.park} aria-hidden="true">
        <path d="m675 430 92-48 110 55-95 49z" fill="#a8d69a" stroke="#84bc7c" strokeWidth="3" />
        <path d="m704 437 60-31 72 36-62 32z" fill="#d8e5b1" />
        <path d="M752 407v61M712 433l104 16" stroke="#f4eed8" strokeWidth="5" opacity=".8" />
      </g>

      <SmallBuilding x={70} y={160} scale={1.05} roof="#92cae5" left="#73adc9" right="#5c94b3" />
      <SmallBuilding x={190} y={105} scale={0.82} roof="#f3b5a7" left="#d99085" right="#c87872" compact />
      <SmallBuilding x={337} y={85} scale={0.94} roof="#d1b9ed" left="#ad91d0" right="#9476ba" />
      <SmallBuilding x={622} y={95} scale={0.9} roof="#f0cc86" left="#dcb56c" right="#c99a51" />
      <SmallBuilding x={820} y={78} scale={1.05} roof="#95d3bd" left="#6db69d" right="#549b84" />
      <SmallBuilding x={77} y={370} scale={0.82} roof="#f5c8ae" left="#dfa589" right="#c98d73" compact />
      <SmallBuilding x={575} y={470} scale={0.86} roof="#a9c7eb" left="#85a8d2" right="#6f90ba" wide />
      <SmallBuilding x={865} y={402} scale={0.94} roof="#e8b9d2" left="#cc94b3" right="#b67c9d" />

      <Tree x={38} y={295} /><Tree x={156} y={295} /><Tree x={288} y={190} /><Tree x={565} y={190} /><Tree x={721} y={148} />
      <Tree x={839} y={340} /><Tree x={888} y={320} /><Tree x={715} y={474} /><Tree x={823} y={460} wide /><Tree x={932} y={340} wide />

      <g role="button" tabIndex={0} aria-label={`Producer 출발센터, ${statusText(producerState)}`} onClick={inspect('producer')} onKeyDown={inspectWithKeyboard('producer')} className={`${styles.facility} ${styles[producerState]}`} transform="translate(150 302)">
        <path d="m0 52 86-44 105 52-90 46z" fill="#8fd1df" filter="url(#city-shadow)" />
        <path d="M0 52v88l101 50v-84z" fill="#63adbd" />
        <path d="M101 106v84l90-45V60z" fill="#4d92a4" />
        <path d="m30 38 54-28 74 37-57 29z" fill="#b9e5ec" />
        <path d="M24 99h54v58H24z" fill="#f5f0df" stroke="#397b8b" strokeWidth="4" />
        <path d="M34 111h34M34 125h34M34 139h34" stroke="#8aa0a1" strokeWidth="3" />
        <path d="M128 112h36v32h-36z" fill="#dff5f3" stroke="#397b8b" strokeWidth="3" />
        <circle cx="146" cy="128" r="7" fill={producerState === 'complete' ? '#238a5b' : '#0e9da0'} />
        <g className={styles.facilitySign} transform="translate(4 170)"><rect width="177" height="30" rx="6" /><text x="88" y="19" textAnchor="middle">PRODUCER 출발센터 · {statusText(producerState)}</text></g>
      </g>

      <g role="button" tabIndex={0} aria-label={`Serializer 검사소, ${statusText(serializerState)}`} onClick={inspect('serializer')} onKeyDown={inspectWithKeyboard('serializer')} className={`${styles.facility} ${styles[serializerState]} ${serializerFocused ? styles.focused : ''}`} transform="translate(415 264)">
        <path d="m8 78 74-38 91 45-78 40z" fill="#c8b8e8" filter="url(#city-shadow)" />
        <path d="M28 73v107h24V85zm108 5v102h25V91z" fill="#8e76bd" stroke="#6f57a2" strokeWidth="3" />
        <path d="M28 72 82 44l79 39-25 13-53-27-31 16z" fill="#dfd5f2" />
        <path d="M50 104h87v31H50z" fill="#f8f6fc" stroke="#8066b3" strokeWidth="3" />
        <text x="94" y="123" textAnchor="middle" className={styles.gateText}>{isFailure ? 'TYPE ERROR' : serializerState === 'complete' ? 'PASS' : 'CHECK'}</text>
        <g className={`${styles.barrier} ${isFailure ? styles.barrierClosed : styles.barrierOpen}`}>
          <rect x="54" y="148" width="78" height="8" rx="3" fill="#ffffff" stroke="#d84a5b" strokeWidth="2" />
          <path d="M62 149 75 155m10-6 13 6m10-6 13 6" stroke="#d84a5b" strokeWidth="4" />
          <circle cx="54" cy="152" r="8" fill="#7656c9" />
        </g>
        {isFailure && <g className={styles.errorSign} transform="translate(5 194)"><rect width="180" height="31" rx="6" /><text x="90" y="20" textAnchor="middle">OrderEvent ≠ StringSerializer</text></g>}
        {!isFailure && <g className={styles.facilitySign} transform="translate(8 194)"><rect width="174" height="30" rx="6" /><text x="87" y="19" textAnchor="middle">SERIALIZER 검사소 · {statusText(serializerState)}</text></g>}
      </g>

      <g role="button" tabIndex={0} aria-label={`Broker 기록센터, ${statusText(brokerState)}`} onClick={inspect('broker')} onKeyDown={inspectWithKeyboard('broker')} className={`${styles.facility} ${styles[brokerState]}`} transform="translate(728 164)">
        <path d="m0 76 100-51 123 61-105 54z" fill="#9dc7e5" filter="url(#city-shadow)" />
        <path d="M0 76v123l118 59V140z" fill="#6c9fc6" />
        <path d="M118 140v118l105-52V86z" fill="#557fa8" />
        <path d="m31 60 69-35 91 45-73 38z" fill="#c6e0f2" />
        <path d="M28 126h57v76H28z" fill="#f7fbfc" stroke="#456f95" strokeWidth="4" />
        <path d="M41 145h31M41 163h31M41 181h31" stroke={brokerState === 'complete' ? '#238a5b' : '#74a0b9'} strokeWidth="5" />
        <path d="m146 130 48-24v25l-48 24zm0 40 48-24v25l-48 24z" fill="#8eb7d4" stroke="#456f95" strokeWidth="3" />
        <g className={styles.facilitySign} transform="translate(20 241)"><rect width="182" height="30" rx="6" /><text x="91" y="19" textAnchor="middle">BROKER 기록센터 · {statusText(brokerState)}</text></g>
      </g>

      <g className={`${styles.vehicle} ${isFailure ? styles.vehicleFailed : ''}`} style={vehicleStyle} aria-hidden="true">
        <ellipse cx="0" cy="24" rx="45" ry="14" fill="#5a6870" opacity=".2" />
        <path d="m-42-4 45-22 54 27-46 23z" fill="#ffd161" stroke="#805d1d" strokeWidth="3" />
        <path d="M-42-4v29L11 52V24z" fill="#e6a829" stroke="#805d1d" strokeWidth="3" />
        <path d="M11 24v28L57 29V1z" fill="#c98916" stroke="#805d1d" strokeWidth="3" />
        <path d="m-22-14 25-12L34-11 8 2z" fill="#fff2b9" stroke="#805d1d" strokeWidth="2" />
        <path d="m34-11 23 12-19 9L17 0z" fill="#dff2f6" stroke="#547889" strokeWidth="2" />
        <circle cx="-25" cy="34" r="8" fill="#39434a" /><circle cx="34" cy="42" r="8" fill="#39434a" />
        <rect x="-13" y="7" width="34" height="14" rx="3" fill="#fff8dd" /><text x="4" y="17" textAnchor="middle" className={styles.vehicleLabel}>OrderEvent</text>
        <rect x="-29" y="-10" width="30" height="11" rx="2" fill="#293d4d" /><text x="-14" y="-2" textAnchor="middle" className={styles.plateLabel}>order-2401</text>
        <g transform="translate(39 -18)"><rect width="43" height="16" rx="8" fill="#ffffff" stroke="#d8ad47" /><text x="21.5" y="11" textAnchor="middle" className={styles.attemptLabel}>attempt {attempt}</text></g>
      </g>

      {ackVisible && (
        <g role="button" tabIndex={0} aria-label={`Producer 도착 문자, ${statusText(ackState)}`} onClick={inspect('ack')} onKeyDown={inspectWithKeyboard('ack')} className={`${styles.ackSignal} ${ackFocused ? styles.focused : ''}`}>
          <path d="M790 230C690 95 365 102 252 310" fill="none" stroke="#238a5b" strokeWidth="4" strokeDasharray="9 10" markerEnd="url(#signal-arrow)" />
          <circle cx="705" cy="154" r="8" fill="#e8f7ef" stroke="#238a5b" strokeWidth="3" />
          <circle cx="588" cy="130" r="8" fill="#e8f7ef" stroke="#238a5b" strokeWidth="3" />
          <g className={styles.smsBubble} transform="translate(190 188)">
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
        <text x="14" y="20">EVENT CITY DISTRICT</text>
        <text x="14" y="35">orders.v1 · partition 0</text>
      </g>
    </svg>
  )
}
