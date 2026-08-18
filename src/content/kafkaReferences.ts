export type KafkaReferenceId =
  | 'kafka-introduction'
  | 'producer-configs'
  | 'topic-configs'
  | 'consumer-configs'
  | 'consumer-rebalance-protocol'
  | 'consumer-offset-tracking'
  | 'kafka-producer-api'

export interface KafkaReference {
  id: KafkaReferenceId
  title: string
  url: string
  version: '4.3.1'
  supports: readonly string[]
}

export const KAFKA_RULE_BASIS = '4.3.1' as const

export const kafkaReferences: readonly KafkaReference[] = [
  {
    id: 'kafka-introduction',
    title: 'Introduction | Apache Kafka',
    url: 'https://kafka.apache.org/documentation/',
    version: KAFKA_RULE_BASIS,
    supports: ['event keys', 'partition selection', 'partition-local ordering', 'replication overview'],
  },
  {
    id: 'producer-configs',
    title: 'Producer Configs | Apache Kafka 4.3',
    url: 'https://kafka.apache.org/43/configuration/producer-configs/',
    version: KAFKA_RULE_BASIS,
    supports: [
      'acks',
      'delivery.timeout.ms',
      'retries',
      'enable.idempotence',
      'max.in.flight.requests.per.connection',
      'partitioner.ignore.keys',
      'transactional.id',
    ],
  },
  {
    id: 'topic-configs',
    title: 'Topic Configs | Apache Kafka 4.3',
    url: 'https://kafka.apache.org/43/configuration/topic-configs/',
    version: KAFKA_RULE_BASIS,
    supports: ['replication', 'in-sync replicas', 'min.insync.replicas', 'acks=all failure conditions'],
  },
  {
    id: 'consumer-configs',
    title: 'Consumer and Share Consumer Configs | Apache Kafka 4.3',
    url: 'https://kafka.apache.org/43/configuration/consumer-configs/',
    version: KAFKA_RULE_BASIS,
    supports: [
      'enable.auto.commit',
      'max.poll.interval.ms',
      'partition assignment',
      'group.protocol',
      'isolation.level',
    ],
  },
  {
    id: 'consumer-rebalance-protocol',
    title: 'Consumer Rebalance Protocol | Apache Kafka 4.3',
    url: 'https://kafka.apache.org/43/operations/consumer-rebalance-protocol/',
    version: KAFKA_RULE_BASIS,
    supports: ['classic protocol', 'consumer protocol', 'incremental rebalance', 'Kafka 4.x protocol differences'],
  },
  {
    id: 'consumer-offset-tracking',
    title: 'Distribution: Consumer Offset Tracking | Apache Kafka 4.3',
    url: 'https://kafka.apache.org/43/implementation/distribution/',
    version: KAFKA_RULE_BASIS,
    supports: ['committed offsets', 'group coordinator', '__consumer_offsets', 'automatic and manual commit'],
  },
  {
    id: 'kafka-producer-api',
    title: 'KafkaProducer API | Apache Kafka 4.3.1',
    url: 'https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/producer/KafkaProducer.html',
    version: KAFKA_RULE_BASIS,
    supports: [
      'idempotent producer',
      'transactional producer',
      'begin/commit/abort transaction',
      'sendOffsetsToTransaction',
      'consume-transform-produce',
    ],
  },
] as const

export function getKafkaReference(id: KafkaReferenceId): KafkaReference {
  const reference = kafkaReferences.find((candidate) => candidate.id === id)

  if (!reference) {
    throw new Error(`Unknown Kafka reference: ${id}`)
  }

  return reference
}
