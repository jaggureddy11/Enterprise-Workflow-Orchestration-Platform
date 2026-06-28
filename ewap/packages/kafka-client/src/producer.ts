// packages/kafka-client/src/producer.ts
// Shared Kafka producer factory per PRD §6.4

import { Kafka, Producer, ProducerRecord, CompressionTypes } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { BaseEvent } from '@ewap/shared';

let producer: Producer | null = null;
let kafka: Kafka | null = null;

export function getKafkaInstance(): Kafka {
  if (!kafka) {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
    const clientId = process.env.KAFKA_CLIENT_ID ?? 'ewap-services';

    kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });
  }
  return kafka;
}

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafka = getKafkaInstance();
    producer = kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
      idempotent: true, // exactly-once producer semantics
    });

    await producer.connect();

    // Graceful shutdown
    const shutdown = async () => {
      if (producer) {
        await producer.disconnect();
        producer = null;
      }
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }
  return producer;
}

/**
 * Publishes a typed event to a Kafka topic.
 * Automatically adds eventId, timestamp, and version if not present.
 */
export async function publishEvent<T extends BaseEvent>(
  topic: string,
  event: Omit<T, 'eventId' | 'timestamp' | 'version'> & Partial<Pick<T, 'eventId' | 'timestamp' | 'version'>>,
): Promise<void> {
  const prod = await getProducer();

  const fullEvent: T = {
    ...event,
    eventId: event.eventId ?? uuidv4(),
    timestamp: event.timestamp ?? new Date().toISOString(),
    version: event.version ?? '1.0',
  } as T;

  const record: ProducerRecord = {
    topic,
    messages: [
      {
        key: fullEvent.correlationId,
        value: JSON.stringify(fullEvent),
        headers: {
          'content-type': 'application/json',
          'event-type': fullEvent.eventType,
          'tenant-id': fullEvent.tenantId,
          'correlation-id': fullEvent.correlationId,
        },
      },
    ],
    compression: CompressionTypes.GZIP,
  };

  await prod.send(record);
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
