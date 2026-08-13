import type { CSSProperties, KeyboardEvent } from 'react'

import type {
  ComponentId,
  ComponentState,
  SimulationEvent,
  SimulationRun,
} from '../domain/simulation'

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
      <path d="M0 88 505 0h495v610H0z" fill="#f4eddf" />
      <path d="M0 510 250 446 506 378 1000 246V610H0z" fill="#f1e8d7" />

      <g className={styles.roadBed} aria-hidden="true">
        <path d="M-90 544 322 437 486 382 1080 225" fill="none" stroke="#302840" strokeWidth="108" opacity=".3" />
        <path d="M-90 533 322 426 486 371 1080 214" fill="none" stroke="url(#road)" strokeWidth="98" />
        <path d="M-90 533 322 426 486 371 1080 214" fill="none" stroke="#fff2cf" strokeWidth="3" strokeDasharray="26 18" />
        <path d="M130 610 370 421 577 0" fill="none" stroke="#6a626b" strokeWidth="58" opacity=".16" />
        <path d="M130 610 370 421 577 0" fill="none" stroke="#979096" strokeWidth="50" />
        <path d="M130 610 370 421 577 0" fill="none" stroke="#fff2cf" strokeWidth="2" strokeDasharray="20 15" />
        <path d="M690 610 676 322 870 0" fill="none" stroke="#6a626b" strokeWidth="53" opacity=".16" />
        <path d="M690 610 676 322 870 0" fill="none" stroke="#979096" strokeWidth="45" />
        <path d="M690 610 676 322 870 0" fill="none" stroke="#fff2cf" strokeWidth="2" strokeDasharray="20 15" />
        <CitySprite id="road-straight" x={276} y={465} scale={0.32} />
        <CitySprite id="road-intersection" x={476} y={406} scale={0.32} />
        <CitySprite id="road-t-junction" x={659} y={349} scale={0.3} />
        <CitySprite id="road-corner" x={857} y={299} scale={0.3} />
      </g>

      <g className={styles.backgroundCity} aria-hidden="true">
        <CitySprite id="building-townhouse" x={52} y={269} scale={0.56} />
        <CitySprite id="building-small-apartment" x={184} y={238} scale={0.55} className={styles.standardOnly} />
        <CitySprite id="building-modern-office" x={325} y={222} scale={0.52} />
        <CitySprite id="building-coffee-shop" x={586} y={210} scale={0.5} />
        <CitySprite id="building-midrise-apartment" x={710} y={188} scale={0.48} />
        <CitySprite id="building-corner-store" x={902} y={207} scale={0.49} />
        <CitySprite id="building-small-apartment" x={980} y={330} scale={0.52} className={styles.wideOnly} />
        <CitySprite id="tree-round" x={120} y={288} scale={0.48} />
        <CitySprite id="tree-conical" x={255} y={243} scale={0.45} />
        <CitySprite id="tree-oval" x={516} y={230} scale={0.45} />
        <CitySprite id="tree-round" x={785} y={213} scale={0.45} />
        <CitySprite id="tree-conical" x={844} y={218} scale={0.42} />
        <CitySprite id="tree-round" x={228} y={314} scale={0.36} className={styles.wideOnly} />
        <CitySprite id="tree-oval" x={556} y={282} scale={0.36} className={styles.wideOnly} />
        <CitySprite id="tree-conical" x={902} y={260} scale={0.36} className={styles.wideOnly} />
        <CitySprite id="tree-round" x={972} y={375} scale={0.36} className={styles.wideOnly} />
        <CitySprite id="vehicle-coral-car" x={605} y={174} scale={0.3} className={styles.wideOnly} />
      </g>

      <g className={styles.route} aria-hidden="true">
        <path d="M248 432 444 375 510 357 784 284" fill="none" stroke="#65736e" strokeWidth="10" opacity=".25" />
        <path d="M248 432 444 375 510 357 784 284" fill="none" stroke={isFailure ? '#aab2ad' : '#0e9da0'} strokeWidth="5" strokeDasharray="11 10" className={railState === 'active' ? styles.routeActive : ''} />
        {isFailure && <path d="M500 359 784 284" fill="none" stroke="#c2c6c2" strokeWidth="6" strokeDasharray="7 12" />}
      </g>

      <g className={styles.foregroundCity} aria-hidden="true">
        <CitySprite id="building-corner-store" x={88} y={548} scale={0.5} className={styles.standardOnly} />
        <CitySprite id="building-coffee-shop" x={598} y={568} scale={0.5} className={styles.wideOnly} />
        <CitySprite id="park-garden" x={810} y={538} scale={0.55} />
        <CitySprite id="tree-oval" x={48} y={406} scale={0.42} className={styles.standardOnly} />
        <CitySprite id="tree-round" x={165} y={372} scale={0.47} />
        <CitySprite id="tree-conical" x={325} y={510} scale={0.48} />
        <CitySprite id="tree-round" x={690} y={520} scale={0.48} />
        <CitySprite id="tree-oval" x={930} y={432} scale={0.46} className={styles.standardOnly} />
        <CitySprite id="vehicle-coral-car" x={706} y={392} scale={0.34} />
        <CitySprite id="vehicle-teal-car" x={934} y={327} scale={0.34} className={styles.standardOnly} />
        <CitySprite id="prop-street-lamp" x={540} y={450} scale={0.34} />
        <CitySprite id="prop-street-lamp" x={888} y={380} scale={0.34} className={styles.wideOnly} />
      </g>

      <g role="button" tabIndex={0} aria-label={`Producer 출발센터, ${statusText(producerState)}`} onClick={inspect('producer')} onKeyDown={inspectWithKeyboard('producer')} className={`${styles.facility} ${styles[producerState]}`} transform="translate(150 302)">
        <path d="m0 52 86-44 105 52-90 46z" fill="#74d3df" stroke="#302840" strokeWidth="5" strokeLinejoin="round" filter="url(#city-shadow)" />
        <path d="M0 52v88l101 50v-84z" fill="#38adbe" stroke="#302840" strokeWidth="5" strokeLinejoin="round" />
        <path d="M101 106v84l90-45V60z" fill="#21839a" stroke="#302840" strokeWidth="5" strokeLinejoin="round" />
        <path d="m30 38 54-28 74 37-57 29z" fill="#bdeff0" stroke="#302840" strokeWidth="4" strokeLinejoin="round" />
        <path d="M24 99h54v58H24z" fill="#fff1cf" stroke="#302840" strokeWidth="4" />
        <path d="M34 111h34M34 125h34M34 139h34" stroke="#7c7080" strokeWidth="4" />
        <path d="M128 112h36v32h-36z" fill="#d7f1ee" stroke="#302840" strokeWidth="4" />
        <path d="m132 116 28 14-28 14z" fill="#7fd8d4" opacity=".72" />
        <rect x="52" y="27" width="74" height="24" fill="#fff0cf" stroke="#302840" strokeWidth="4" />
        <path d="M62 36h54" stroke="#efb15c" strokeWidth="5" />
        <circle cx="146" cy="128" r="8" fill={producerState === 'complete' ? '#61db94' : '#55d7d0'} stroke="#302840" strokeWidth="3" />
        <g className={styles.facilitySign} transform="translate(4 170)"><rect width="177" height="30" rx="6" /><text x="88" y="19" textAnchor="middle">PRODUCER 출발센터 · {statusText(producerState)}</text></g>
      </g>

      <g role="button" tabIndex={0} aria-label={`Serializer 검사소, ${statusText(serializerState)}`} onClick={inspect('serializer')} onKeyDown={inspectWithKeyboard('serializer')} className={`${styles.facility} ${styles[serializerState]} ${serializerFocused ? styles.focused : ''}`} transform="translate(415 264)">
        <path d="m8 78 74-38 91 45-78 40z" fill="#c8afe7" stroke="#302840" strokeWidth="5" strokeLinejoin="round" filter="url(#city-shadow)" />
        <path d="M28 73v107h24V85zm108 5v102h25V91z" fill="#9271c4" stroke="#302840" strokeWidth="5" strokeLinejoin="round" />
        <path d="M28 72 82 44l79 39-25 13-53-27-31 16z" fill="#eadcf6" stroke="#302840" strokeWidth="4" strokeLinejoin="round" />
        <path d="M50 104h87v31H50z" fill="#fff1cf" stroke="#302840" strokeWidth="4" />
        <path d="M36 95h18m76 4h18M38 166h12m90 0h12" stroke="#f1c56f" strokeWidth="5" />
        <text x="94" y="123" textAnchor="middle" className={styles.gateText}>{isFailure ? 'TYPE ERROR' : serializerState === 'complete' ? 'PASS' : 'CHECK'}</text>
        <g className={`${styles.barrier} ${isFailure ? styles.barrierClosed : styles.barrierOpen}`}>
          <rect x="54" y="148" width="78" height="8" rx="3" fill="#ffffff" stroke="#d84a5b" strokeWidth="2" />
          <path d="M62 149 75 155m10-6 13 6m10-6 13 6" stroke="#d84a5b" strokeWidth="4" />
          <circle cx="54" cy="152" r="8" fill="#7656c9" stroke="#302840" strokeWidth="3" />
        </g>
        {isFailure && <g className={styles.errorSign} transform="translate(5 194)"><rect width="180" height="31" rx="6" /><text x="90" y="20" textAnchor="middle">OrderEvent ≠ StringSerializer</text></g>}
        {!isFailure && <g className={styles.facilitySign} transform="translate(8 194)"><rect width="174" height="30" rx="6" /><text x="87" y="19" textAnchor="middle">SERIALIZER 검사소 · {statusText(serializerState)}</text></g>}
      </g>

      <g role="button" tabIndex={0} aria-label={`Broker 기록센터, ${statusText(brokerState)}`} onClick={inspect('broker')} onKeyDown={inspectWithKeyboard('broker')} className={`${styles.facility} ${styles[brokerState]}`} transform="translate(728 164)">
        <path d="m0 76 100-51 123 61-105 54z" fill="#73aee5" stroke="#302840" strokeWidth="5" strokeLinejoin="round" filter="url(#city-shadow)" />
        <path d="M0 76v123l118 59V140z" fill="#467fbd" stroke="#302840" strokeWidth="5" strokeLinejoin="round" />
        <path d="M118 140v118l105-52V86z" fill="#315f9a" stroke="#302840" strokeWidth="5" strokeLinejoin="round" />
        <path d="m31 60 69-35 91 45-73 38z" fill="#bcd9f2" stroke="#302840" strokeWidth="4" strokeLinejoin="round" />
        <path d="M28 126h57v76H28z" fill="#fff1cf" stroke="#302840" strokeWidth="5" />
        <path d="M41 145h31M41 163h31M41 181h31" stroke={brokerState === 'complete' ? '#238a5b' : '#74a0b9'} strokeWidth="5" />
        <path d="m146 130 48-24v25l-48 24zm0 40 48-24v25l-48 24z" fill="#8dbce0" stroke="#302840" strokeWidth="4" />
        <path d="m157 58 25 12v38l-25-12zm-35-17 21 10v49l-21-10z" fill="#6e91bb" stroke="#302840" strokeWidth="4" />
        <rect x="52" y="61" width="95" height="25" fill="#fff0cf" stroke="#302840" strokeWidth="4" />
        <path d="M64 71h71" stroke="#efb15c" strokeWidth="5" />
        <g className={styles.facilitySign} transform="translate(20 241)"><rect width="182" height="30" rx="6" /><text x="91" y="19" textAnchor="middle">BROKER 기록센터 · {statusText(brokerState)}</text></g>
      </g>

      <g className={`${styles.vehicle} ${isFailure ? styles.vehicleFailed : ''}`} style={vehicleStyle} aria-hidden="true">
        <ellipse cx="0" cy="27" rx="47" ry="15" fill="#302840" opacity=".18" />
        <path d="m-44-5 47-23 55 27-47 24z" fill="#ffd45e" stroke="#302840" strokeWidth="4" strokeLinejoin="round" />
        <path d="M-44-5v30L11 53V23z" fill="#edae29" stroke="#302840" strokeWidth="4" strokeLinejoin="round" />
        <path d="M11 23v30L58 29V-1z" fill="#d48c18" stroke="#302840" strokeWidth="4" strokeLinejoin="round" />
        <path d="m-23-15 26-13L35-12 8 2z" fill="#fff0b5" stroke="#302840" strokeWidth="3" />
        <path d="m35-12 23 11-20 10L17 0z" fill="#a9dce2" stroke="#302840" strokeWidth="3" />
        <circle cx="-25" cy="35" r="9" fill="#302840" /><circle cx="35" cy="43" r="9" fill="#302840" />
        <circle cx="-25" cy="35" r="4" fill="#8994a2" /><circle cx="35" cy="43" r="4" fill="#8994a2" />
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
