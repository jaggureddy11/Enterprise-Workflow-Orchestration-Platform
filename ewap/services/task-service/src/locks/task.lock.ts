// services/task-service/src/locks/task.lock.ts
// Redis distributed lock with Lua compare-and-delete per PRD §9.3

import Redis from 'ioredis';
import { REDIS_KEYS, REDIS_TTL } from '@ewap/shared';

const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export class TaskLock {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async acquire(taskId: string, ownerId: string): Promise<string | null> {
    const lockKey = REDIS_KEYS.TASK_LOCK(taskId);
    const lockValue = `${ownerId}-${Date.now()}-${Math.random()}`;

    const acquired = await this.redis.set(
      lockKey,
      lockValue,
      'NX',
      'EX',
      REDIS_TTL.DISTRIBUTED_LOCK,
    );

    return acquired ? lockValue : null;
  }

  async release(taskId: string, lockValue: string): Promise<void> {
    const lockKey = REDIS_KEYS.TASK_LOCK(taskId);
    await (this.redis as any).eval(RELEASE_SCRIPT, 1, lockKey, lockValue);
  }
}
