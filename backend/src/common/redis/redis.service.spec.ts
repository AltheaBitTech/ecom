import { AppConfig } from '../config/app-config';
import { RedisService } from './redis.service';

describe('RedisService in-memory fallback (no REDIS_URL)', () => {
  const service = new RedisService({ redisUrl: undefined } as AppConfig);

  it('stores, reads and deletes JSON', async () => {
    await service.setJson('k', { a: 1 }, 60);
    expect(await service.getJson('k')).toEqual({ a: 1 });
    await service.del('k');
    expect(await service.getJson('k')).toBeNull();
  });

  it('increments counters and expires them', async () => {
    jest.useFakeTimers();
    expect(await service.incrWithTtl('c', 10)).toBe(1);
    expect(await service.incrWithTtl('c', 10)).toBe(2);
    jest.advanceTimersByTime(11_000);
    expect(await service.getJson('c')).toBeNull();
    expect(await service.incrWithTtl('c', 10)).toBe(1);
    jest.useRealTimers();
  });

  it('reports healthy', async () => {
    expect(await service.ping()).toBe(true);
  });
});
