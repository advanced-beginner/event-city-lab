export const APP_VERSION = '0.1.0' as const
export const CONTENT_VERSION = '2026.1' as const
export const KAFKA_RULE_VERSION = '4.3.1' as const
export const STORAGE_SCHEMA_VERSION = 1 as const

export type SerializerKind = 'string' | 'json'
export type RunStatus = 'failed' | 'succeeded'
export type ComponentId = 'producer' | 'serializer' | 'rail' | 'broker' | 'ack'
export type ComponentState = 'idle' | 'active' | 'blocked' | 'failed' | 'complete'

export interface LabMessage {
  messageId: string
  key: string
  value: {
    orderId: string
    amount: number
    customer: string
  }
}

export interface ProducerConfig {
  serializer: SerializerKind
  acks: 'all'
  topic: string
}

export interface SimulationInput {
  runId: string
  seed: number
  message: LabMessage
  config: ProducerConfig
}

export type SimulationEventKind =
  | 'command.accepted'
  | 'producer.preparing'
  | 'serializer.inspecting'
  | 'serializer.rejected'
  | 'serializer.completed'
  | 'network.dispatched'
  | 'broker.received'
  | 'broker.appended'
  | 'ack.returned'
  | 'run.completed'

export interface SimulationEvent {
  id: string
  sequence: number
  atMs: number
  kind: SimulationEventKind
  component: ComponentId
  state: ComponentState
  title: string
  detail: string
  log: string
  setting?: keyof ProducerConfig | undefined
}

export interface RunDiagnosis {
  symptom: string
  rootCause: string
  evidence: string[]
  setting: keyof ProducerConfig
  currentValue: string
  recommendedValue: string
  tradeOff: string
}

export interface SimulationRun {
  runId: string
  seed: number
  messageId: string
  status: RunStatus
  config: ProducerConfig
  events: SimulationEvent[]
  diagnosis: RunDiagnosis | null
  summary: string
}

export interface WorkspaceSnapshot {
  storageSchemaVersion: typeof STORAGE_SCHEMA_VERSION
  appVersion: string
  contentVersion: string
  kafkaRuleVersion: string
  savedAt: string
  config: ProducerConfig
  message: LabMessage
  runs: SimulationRun[]
  hintLevel: number
  chapterCompleted: boolean
}

export const DEFAULT_MESSAGE: LabMessage = {
  messageId: 'order-2401',
  key: 'customer-17',
  value: {
    orderId: 'ORD-2401',
    amount: 42000,
    customer: '김이벤트',
  },
}

export const DEFAULT_CONFIG: ProducerConfig = {
  serializer: 'string',
  acks: 'all',
  topic: 'orders.v1',
}
