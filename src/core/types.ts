export interface CacheEntry<T> {
  data: T;
  etag: string;
  cachedAt: number;
}

export interface ResolveOptions {
  ttl?: number;                 // seconds, default 300
  staleWhileRevalidate?: boolean; // default true
  alwaysFetch?: boolean;        // dev mode: always fetch, update cache only if etag changed
}

export interface Provider {
  name: string;
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  put<T>(key: string, entry: CacheEntry<T>, ttl?: number): Promise<void>;
}

// A query definition — key function is isomorphic, fetcher is provider-specific
export interface QueryDef<TParams, TResult> {
  key: (params: TParams) => string;
}

export type FetcherResult<TResult> = { data: TResult; etag: string } | { notModified: true };
export type Fetcher<TParams, TResult> = (params: TParams, cachedEtag?: string) => Promise<FetcherResult<TResult>>;
