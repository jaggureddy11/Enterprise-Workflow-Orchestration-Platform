// packages/kafka-client/src/consumer.ts
// Shared Kafka consumer factory per PRD §6.4

import { Consumer, EachMessagePayload } from 'kafkajs';
import { getKafkaInstance } from './producer';
import { KafkaEvent } from '@ewap/shared';

export interface ConsumerConfig {
  groupId: string;
  topics: string[];
  onMessage: (event: KafkaEvent, payload: EachMessagePayload) => Promise<void>;
  onError?: (error: Error, payload: EachMessagePayload) => Promise<void>;
}

const activeConsumers: Consumer[] = [];

/**
 * Creates and starts a Kafka consumer for a given group and set of topics.
 */
export async function createConsumer(config: ConsumerConfig): Promise<Consumer> {
  const kafka = getKafkaInstance();

  const consumer = kafka.consumer({
    groupId: config.groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxWaitTimeInMs: 5000,
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
  });

  await consumer.connect();
  await consumer.subscribe({ topics: config.topics, fromBeginning: false });

  await consumer.run({
    autoCommit: true,
    eachMessage: async (payload: EachMessagePayload) => {
      const { topic, partition, message } = payload;

      if (!message.value) {
        console.warn(`[Kafka] Empty message on topic ${topic} partition ${partition}`);
        return;
      }

      try {
        const event = JSON.parse(message.value.toString()) as KafkaEvent;
        await config.onMessage(event, payload);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (config.onError) {
          await config.onError(err, payload);
        } else {
          console.error(`[Kafka] Error processing message on topic ${topic}:`, err);
          throw err; // Rethrow to trigger KafkaJS retry
        }
      }
    },
  });

  activeConsumers.push(consumer);

  // Graceful shutdown
  const shutdown = async () => {
    await consumer.disconnect();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  return consumer;
}

/**
 * Disconnects all active consumers.
 */
export async function disconnectAllConsumers(): Promise<void> {
  await Promise.all(activeConsumers.map(c => c.disconnect()));
  activeConsumers.length = 0;
}
