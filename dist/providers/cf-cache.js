export class CfCacheProvider {
    name = 'cf-cache';
    async get(key) {
        const cache = caches.default;
        const res = await cache.match(new Request(key));
        if (!res)
            return null;
        const etag = res.headers.get('ETag') ?? '';
        if (!etag)
            return null; // stale entry without etag — force re-fetch
        const cachedAt = Number(res.headers.get('X-Cascade-CachedAt') ?? '0');
        const data = await res.json();
        return { data, etag, cachedAt };
    }
    async invalidate(key) {
        const cache = caches.default;
        await cache.delete(new Request(key));
    }
    async put(key, entry, ttl = 300) {
        const cache = caches.default;
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
