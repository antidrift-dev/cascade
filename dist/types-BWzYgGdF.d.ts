interface CacheEntry<T> {
    data: T;
    etag: string;
    cachedAt: number;
}
interface ResolveOptions {
    ttl?: number;
    staleWhileRevalidate?: boolean;
    alwaysFetch?: boolean;
}
interface Provider {
    name: string;
    get<T>(key: string): Promise<CacheEntry<T> | null>;
    put<T>(key: string, entry: CacheEntry<T>, ttl?: number): Promise<void>;
}
interface QueryDef<TParams, TResult> {
    key: (params: TParams) => string;
}
type FetcherResult<TResult> = {
    data: TResult;
    etag: string;
} | {
    notModified: true;
};
type Fetcher<TParams, TResult> = (params: TParams, cachedEtag?: string) => Promise<FetcherResult<TResult>>;

export type { CacheEntry as C, Fetcher as F, Provider as P, QueryDef as Q, ResolveOptions as R };
