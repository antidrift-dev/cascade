import type { Provider, CacheEntry, ResolveOptions, QueryDef, Fetcher, FetcherResult } from './types.js';

export class Cascade {
  constructor(private readonly providers: Provider[]) {}

  async resolve<TParams, TResult>(
    query: QueryDef<TParams, TResult>,
    params: TParams,
    fetcher: Fetcher<TParams, TResult>,
    options: ResolveOptions = {}
  ): Promise<TResult> {
    const { ttl = 300, staleWhileRevalidate = true, alwaysFetch = false } = options;
    const key = query.key(params);

    if (alwaysFetch) {
      const existing = await this.providers[0]?.get<TResult>(key);
      const result = await fetcher(params, existing?.etag);
      if ('notModified' in result) return existing!.data;
      const entry: CacheEntry<TResult> = { ...result, cachedAt: Date.now() };
      await this.populate(key, entry, ttl);
      return result.data;
    }

    const boundFetcher = () => fetcher(params);

    for (let i = 0; i < this.providers.length; i++) {
      const entry = await this.providers[i]!.get<TResult>(key);
      if (!entry) continue;

      if (staleWhileRevalidate) {
        this.revalidate(key, entry, boundFetcher, ttl, i).catch(() => {});
      }

      return entry.data;
    }

    const result = await fetcher(params);
    if ('notModified' in result) throw new Error('Cascade: 304 with no cached entry');
    const entry: CacheEntry<TResult> = { ...result, cachedAt: Date.now() };
    await this.populate(key, entry, ttl);
    return result.data;
  }

  private async revalidate<T>(
    key: string,
    current: CacheEntry<T>,
    fetcher: () => Promise<FetcherResult<T>>,
    ttl: number,
    hitIndex: number
  ): Promise<void> {
    const result = await fetcher();
    if ('notModified' in result || result.etag === current.etag) return;
    const fresh: CacheEntry<T> = { ...result, cachedAt: Date.now() };
    for (let i = hitIndex; i < this.providers.length; i++) {
      await this.providers[i]!.put(key, fresh, ttl);
    }
  }

  private async populate<T>(key: string, entry: CacheEntry<T>, ttl: number): Promise<void> {
    await Promise.all(this.providers.map(p => p.put(key, entry, ttl)));
  }
}
