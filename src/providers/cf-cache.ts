import type { Provider, CacheEntry } from '../core/types.js';

export class CfCacheProvider implements Provider {
  readonly name = 'cf-cache';

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const cache = (caches as unknown as { default: Cache }).default;
    const res = await cache.match(new Request(key));
    if (!res) return null;

    const etag = res.headers.get('ETag') ?? '';
    if (!etag) return null; // stale entry without etag — force re-fetch

    const cachedAt = Number(res.headers.get('X-Cascade-CachedAt') ?? '0');
    const data = await res.json() as T;
    return { data, etag, cachedAt };
  }

  async invalidate(key: string): Promise<void> {
    const cache = (caches as unknown as { default: Cache }).default;
    await cache.delete(new Request(key));
  }

  async put<T>(key: string, entry: CacheEntry<T>, ttl = 300): Promise<void> {
    const cache = (caches as unknown as { default: Cache }).default;
    const res = new Response(JSON.stringify(entry.data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}`,
        'ETag': entry.etag,
        'X-Cascade-CachedAt': String(entry.cachedAt),
      },
    });
    await cache.put(new Request(key), res);
  }
}
