#!/bin/bash
set -e

# Wait for Kafka to be ready
echo "Waiting for Kafka to be ready..."
for i in {1..30}; do
  if kafka-broker-api-versions --bootstrap-server kafka:9092 >/dev/null 2>&1; then
    echo "Kafka is ready!"
    break
  fi
  echo "Kafka not ready, waiting... ($i/30)"
  sleep 2
done

# Create topics
TOPICS=(
  "workflow.instance.started:6:1"
  "workflow.instance.completed:6:1"
  "workflow.instance.failed:6:1"
  "workflow.step.started:6:1"
  "workflow.step.completed:6:1"
  "task.create.requested:6:1"
  "task.created:6:1"
  "task.completed:6:1"
  "task.expired:6:1"
  "notification.send.requested:6:1"
  "notification.sent:6:1"
  "notification.failed:6:1"
  "notification.failed.dlq:6:1"
  "audit.event.created:1:1"
)

for topic_config in "${TOPICS[@]}"; do
  IFS=':' read -r topic partitions replication <<< "$topic_config"
  echo "Creating topic: $topic (partitions: $partitions, replication: $replication)"
  
  kafka-topics --create \
    --bootstrap-server kafka:9092 \
    --topic "$topic" \
    --partitions "$partitions" \
    --replication-factor "$replication" \
    --config retention.ms=604800000 \
    --if-not-exists
done

echo "All topics created successfully!"
