import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';

import { AppConfig } from '../config/app-config';

/** Injection token for a pre-built ioredis client (used by tests to inject a mock). */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Thin Redis wrapper for ephemeral, cross-instance state that must not live in
 * process memory: failed-login counters, short-lived login sessions (MFA /
 * tenant selection), password-reset tokens, and email-verification tokens.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: AppConfig, @Optional() @Inject(REDIS_CLIENT) injected?: Redis) {
    this.client = injected ?? new Redis(config.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Store a JSON value with a TTL (seconds). */
  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /** Atomically increment a counter and ensure it expires. Returns new value. */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const value = await this.client.incr(key);
    if (value === 1) await this.client.expire(key, ttlSeconds);
    return value;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /** Liveness probe for the readiness endpoint. */
  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
