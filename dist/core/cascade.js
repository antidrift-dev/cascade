export class Cascade {
    providers;
    constructor(providers) {
        this.providers = providers;
    }
    async resolve(query, params, fetcher, options = {}) {
        const { ttl = 300, staleWhileRevalidate = true, alwaysFetch = false } = options;
        const key = query.key(params);
        if (alwaysFetch) {
            const existing = await this.providers[0]?.get(key);
            const result = await fetcher(params, existing?.etag);
            if ('notModified' in result)
                return existing.data;
            const entry = { ...result, cachedAt: Date.now() };
            await this.populate(key, entry, ttl);
            return result.data;
        }
        const boundFetcher = () => fetcher(params);
        for (let i = 0; i < this.providers.length; i++) {
            const entry = await this.providers[i].get(key);
            if (!entry)
                continue;
            if (staleWhileRevalidate) {
                this.revalidate(key, entry, boundFetcher, ttl, i).catch(() => { });
            }
            return entry.data;
        }
        const result = await fetcher(params);
        if ('notModified' in result)
            throw new Error('Cascade: 304 with no cached entry');
        const entry = { ...result, cachedAt: Date.now() };
        await this.populate(key, entry, ttl);
        return result.data;
    }
    async revalidate(key, current, fetcher, ttl, hitIndex) {
        const result = await fetcher();
        if ('notModified' in result || result.etag === current.etag)
            return;
        const fresh = { ...result, cachedAt: Date.now() };
        for (let i = hitIndex; i < this.providers.length; i++) {
            await this.providers[i].put(key, fresh, ttl);
        }
    }
    async populate(key, entry, ttl) {
        await Promise.all(this.providers.map(p => p.put(key, entry, ttl)));
    }
}
