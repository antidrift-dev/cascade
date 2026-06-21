// src/core/cascade.ts
var Cascade = class {
  constructor(providers) {
    this.providers = providers;
  }
  providers;
  async resolve(query, params, fetcher, options = {}) {
    const { ttl = 300, staleWhileRevalidate = true, alwaysFetch = false } = options;
    const key = query.key(params);
    if (alwaysFetch) {
      const existing = await this.providers[0]?.get(key);
      const result2 = await fetcher(params, existing?.etag);
      if ("notModified" in result2) return existing.data;
      const entry2 = { ...result2, cachedAt: Date.now() };
      await this.populate(key, entry2, ttl);
      return result2.data;
    }
    const boundFetcher = () => fetcher(params);
    for (let i = 0; i < this.providers.length; i++) {
      const entry2 = await this.providers[i].get(key);
      if (!entry2) continue;
      if (staleWhileRevalidate) {
        this.revalidate(key, entry2, boundFetcher, ttl, i).catch(() => {
        });
      }
      return entry2.data;
    }
    const result = await fetcher(params);
    if ("notModified" in result) throw new Error("Cascade: 304 with no cached entry");
    const entry = { ...result, cachedAt: Date.now() };
    await this.populate(key, entry, ttl);
    return result.data;
  }
  async revalidate(key, current, fetcher, ttl, hitIndex) {
    const result = await fetcher();
    if ("notModified" in result || result.etag === current.etag) return;
    const fresh = { ...result, cachedAt: Date.now() };
    for (let i = hitIndex; i < this.providers.length; i++) {
      await this.providers[i].put(key, fresh, ttl);
    }
  }
  async populate(key, entry, ttl) {
    await Promise.all(this.providers.map((p) => p.put(key, entry, ttl)));
  }
};

export {
  Cascade
};
