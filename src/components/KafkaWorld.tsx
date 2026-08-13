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
  if (!activeEvent) return [230, 451, 0]
  if (activeEvent.kind === 'command.accepted' || activeEvent.kind === 'producer.preparing') return [260, 440, -4]
  if (activeEvent.kind === 'serializer.inspecting') return [462, 365, -8]
  if (activeEvent.kind === 'serializer.rejected') return [490, 354, -8]
  if (activeEvent.kind === 'serializer.completed') return [530, 339, -8]
  if (activeEvent.kind === 'network.dispatched') return [674, 286, -8]
  return [815, 234, -8]
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
      <path d="M0 510 250 446 506 378 1000 246V610H0z" fill="#f6ead5" />

      <g className={styles.roadBed} aria-hidden="true">
        {[-50, 50, 150, 250, 350, 450, 550, 650, 750, 850, 950, 1050].map((x, index) => (
          <CitySprite key={`main-${x}`} id="road-straight" x={x} y={548 - index * 37} scale={0.46} />
        ))}

        {[-50, 50, 150, 250, 350, 450, 550, 650].map((x, index) => (
          <CitySprite key={`cross-a-${x}`} id="road-straight" x={x} y={276 + index * 37} scale={0.46} flipX />
        ))}
        {[450, 550, 650, 750, 850, 950, 1050].map((x, index) => (
          <CitySprite key={`cross-b-${x}`} id="road-straight" x={x} y={132 + index * 37} scale={0.46} flipX />
        ))}

        <CitySprite id="road-intersection" x={250} y={389} scale={0.37} />
        <CitySprite id="road-intersection" x={750} y={247} scale={0.37} />
      </g>

      <g className={styles.backgroundCity} aria-hidden="true">
        <CitySprite id="building-townhouse" x={74} y={274} scale={0.46} />
        <CitySprite id="building-small-apartment" x={212} y={239} scale={0.45} className={styles.standardOnly} />
        <CitySprite id="building-modern-office" x={350} y={204} scale={0.45} />
        <CitySprite id="building-coffee-shop" x={520} y={171} scale={0.44} />
        <CitySprite id="building-midrise-apartment" x={686} y={139} scale={0.42} />
        <CitySprite id="building-corner-store" x={884} y={137} scale={0.43} />
        <CitySprite id="tree-round" x={136} y={291} scale={0.36} />
        <CitySprite id="tree-conical" x={280} y={249} scale={0.34} />
        <CitySprite id="tree-oval" x={444} y={207} scale={0.34} />
        <CitySprite id="tree-round" x={608} y={170} scale={0.34} />
        <CitySprite id="tree-conical" x={800} y={144} scale={0.32} />
        <CitySprite id="tree-round" x={968} y={300} scale={0.32} className={styles.wideOnly} />
      </g>

      <g className={styles.route} aria-hidden="true">
        <path d="M230 451 490 354 530 339 815 234" fill="none" stroke="#302840" strokeWidth="8" opacity=".18" />
        <path d="M230 451 490 354 530 339 815 234" fill="none" stroke={isFailure ? '#aab2ad' : '#20a7a1'} strokeWidth="4" strokeDasharray="10 11" className={railState === 'active' ? styles.routeActive : ''} />
        {isFailure && <path d="M530 339 815 234" fill="none" stroke="#c2c6c2" strokeWidth="5" strokeDasharray="7 12" />}
      </g>

      <g className={styles.foregroundCity} aria-hidden="true">
        <CitySprite id="building-corner-store" x={84} y={574} scale={0.42} className={styles.standardOnly} />
        <CitySprite id="building-coffee-shop" x={574} y={579} scale={0.42} className={styles.wideOnly} />
        <CitySprite id="park-garden" x={820} y={555} scale={0.48} />
        <CitySprite id="tree-oval" x={52} y={424} scale={0.34} className={styles.standardOnly} />
        <CitySprite id="tree-round" x={158} y={398} scale={0.36} />
        <CitySprite id="tree-conical" x={376} y={544} scale={0.36} />
        <CitySprite id="tree-round" x={700} y={537} scale={0.36} />
        <CitySprite id="tree-oval" x={948} y={438} scale={0.36} className={styles.standardOnly} />
        <CitySprite id="vehicle-coral-car" x={710} y={416} scale={0.27} />
        <CitySprite id="vehicle-teal-car" x={932} y={340} scale={0.27} className={styles.standardOnly} />
        <CitySprite id="prop-street-lamp" x={596} y={477} scale={0.27} />
      </g>

      <g role="button" tabIndex={0} aria-label={`Producer 출발센터, ${statusText(producerState)}`} onClick={inspect('producer')} onKeyDown={inspectWithKeyboard('producer')} className={`${styles.facility} ${styles[producerState]}`} transform="translate(118 282)">
        <CitySprite id="facility-producer" x={96} y={190} scale={0.62} />
        <text x="84" y="81" textAnchor="middle" className={styles.pixelFacilityName}>PRODUCER</text>
        <circle cx="150" cy="132" r="7" className={styles.stateLamp} data-state={producerState} />
        <g className={styles.facilitySign} transform="translate(15 174)"><rect width="162" height="25" /><text x="81" y="17" textAnchor="middle">출발센터 · {statusText(producerState)}</text></g>
      </g>

      <g role="button" tabIndex={0} aria-label={`Serializer 검사소, ${statusText(serializerState)}`} onClick={inspect('serializer')} onKeyDown={inspectWithKeyboard('serializer')} className={`${styles.facility} ${styles[serializerState]} ${serializerFocused ? styles.focused : ''}`} transform="translate(408 190)">
        <CitySprite id="facility-serializer" x={94} y={190} scale={0.57} />
        <text x="91" y="77" textAnchor="middle" className={styles.pixelFacilityName}>SERIALIZER</text>
        <circle cx="158" cy="144" r="7" className={styles.stateLamp} data-state={serializerState} />
        {isFailure && <g className={styles.errorSign} transform="translate(4 190)"><rect width="180" height="27" /><text x="90" y="18" textAnchor="middle">OrderEvent ≠ StringSerializer</text></g>}
        {!isFailure && <g className={styles.facilitySign} transform="translate(13 190)"><rect width="162" height="25" /><text x="81" y="17" textAnchor="middle">검사소 · {statusText(serializerState)}</text></g>}
      </g>

      <g role="button" tabIndex={0} aria-label={`Broker 기록센터, ${statusText(brokerState)}`} onClick={inspect('broker')} onKeyDown={inspectWithKeyboard('broker')} className={`${styles.facility} ${styles[brokerState]}`} transform="translate(700 4)">
        <CitySprite id="facility-broker" x={111} y={244} scale={0.56} />
        <text x="111" y="92" textAnchor="middle" className={styles.pixelFacilityName}>BROKER</text>
        <circle cx="176" cy="183" r="7" className={styles.stateLamp} data-state={brokerState} />
        <g className={styles.facilitySign} transform="translate(30 231)"><rect width="162" height="25" /><text x="81" y="17" textAnchor="middle">기록센터 · {statusText(brokerState)}</text></g>
      </g>

      <g className={`${styles.vehicle} ${isFailure ? styles.vehicleFailed : ''}`} style={vehicleStyle} aria-hidden="true">
        <CitySprite id="vehicle-kafka-van" x={4} y={52} scale={0.52} flipX />
        <g className={styles.cargoTag} transform="translate(-38 -21)"><rect width="73" height="16" /><text x="36.5" y="11" textAnchor="middle">order-2401 · #{attempt}</text></g>
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
