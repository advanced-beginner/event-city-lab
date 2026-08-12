import type { ProducerConfig, SerializerKind } from './simulation'

const SERIALIZER_CLASS: Record<SerializerKind, string> = {
  string: 'StringSerializer',
  json: 'JsonSerializer',
}

export function configToJava(config: ProducerConfig): string {
  return `var props = new Properties();
props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "broker-1:9092");
props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG,
    ${SERIALIZER_CLASS[config.serializer]}.class);
props.put(ProducerConfig.ACKS_CONFIG, "${config.acks}");

var event = new OrderEvent("ORD-2401", 42000, "김이벤트");
producer.send(new ProducerRecord<>("${config.topic}", "customer-17", event));`
}

export interface JavaConfigParseResult {
  config: ProducerConfig
  warnings: string[]
}

export function javaToConfig(code: string, previous: ProducerConfig): JavaConfigParseResult {
  const serializer: SerializerKind | null = code.includes('JsonSerializer.class')
    ? 'json'
    : code.includes('StringSerializer.class')
      ? 'string'
      : null
  const topicMatch = code.match(/new ProducerRecord<>\(\s*"([^"]+)"/)
  const warnings: string[] = []

  if (!serializer) {
    warnings.push('지원되는 Serializer는 StringSerializer와 JsonSerializer입니다.')
  }
  if (!topicMatch?.[1]) {
    warnings.push('ProducerRecord의 topic 문자열을 찾을 수 없습니다.')
  }

  return {
    config: {
      ...previous,
      serializer: serializer ?? previous.serializer,
      topic: topicMatch?.[1] ?? previous.topic,
    },
    warnings,
  }
}
