import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import Redis from 'ioredis';

import { AppConfig } from '../config/app-config';

/** Injection token for a pre-built ioredis client (used by tests to inject a mock). */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Thin Redis wrapper for ephemeral, cross-instance state that must not live in
 * process memory: failed-login counters, short-lived login sessions (MFA /
 * tenant selection), password-reset tokens, and email-verification tokens.
 */
/**
 * In-process stand-in used when REDIS_URL is unset.
 * ponytail: state is per-instance and lost on restart, so on serverless/multi-instance
 * deploys lockout counters and email/reset/MFA tokens can miss. Set REDIS_URL for production.
 */
class MemoryStore {
  private readonly data = new Map<string, { value: string; expiresAt: number }>();

  private live(key: string): { value: string; expiresAt: number } | undefined {
    const entry = this.data.get(key);
    if (entry && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }

  get(key: string): string | null {
    return this.live(key)?.value ?? null;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  del(key: string): void {
    this.data.delete(key);
  }

  incrWithTtl(key: string, ttlSeconds: number): number {
    const entry = this.live(key);
    const value = (entry ? Number(entry.value) : 0) + 1;
    this.data.set(key, { value: String(value), expiresAt: entry?.expiresAt ?? Date.now() + ttlSeconds * 1000 });
    return value;
  }

  ttl(key: string): number {
    const entry = this.live(key);
    return entry ? Math.ceil((entry.expiresAt - Date.now()) / 1000) : -2;
  }
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client?: Redis;
  private readonly memory?: MemoryStore;

  constructor(config: AppConfig, @Optional() @Inject(REDIS_CLIENT) injected?: Redis) {
    const url = config.redisUrl;
    if (injected) this.client = injected;
    else if (url) this.client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    else {
      this.memory = new MemoryStore();
      this.logger.warn('REDIS_URL not set: using in-memory store (single-instance only).');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }

  /** Store a JSON value with a TTL (seconds). */
  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (this.memory) return this.memory.set(key, raw, ttlSeconds);
    await this.client!.set(key, raw, 'EX', ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = this.memory ? this.memory.get(key) : await this.client!.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async del(key: string): Promise<void> {
    if (this.memory) return this.memory.del(key);
    await this.client!.del(key);
  }

  /** Atomically increment a counter and ensure it expires. Returns new value. */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    if (this.memory) return this.memory.incrWithTtl(key, ttlSeconds);
    const value = await this.client!.incr(key);
    if (value === 1) await this.client!.expire(key, ttlSeconds);
    return value;
  }

  async ttl(key: string): Promise<number> {
    return this.memory ? this.memory.ttl(key) : this.client!.ttl(key);
  }

  /** Liveness probe for the readiness endpoint. True for the in-memory store. */
  async ping(): Promise<boolean> {
    if (this.memory) return true;
    try {
      return (await this.client!.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
