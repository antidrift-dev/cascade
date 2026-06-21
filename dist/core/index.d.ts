import { P as Provider, Q as QueryDef, F as Fetcher, R as ResolveOptions } from '../types-BWzYgGdF.js';
export { C as CacheEntry } from '../types-BWzYgGdF.js';

declare class Cascade {
    private readonly providers;
    constructor(providers: Provider[]);
    resolve<TParams, TResult>(query: QueryDef<TParams, TResult>, params: TParams, fetcher: Fetcher<TParams, TResult>, options?: ResolveOptions): Promise<TResult>;
    private revalidate;
    private populate;
}

export { Cascade, Fetcher, Provider, QueryDef, ResolveOptions };
