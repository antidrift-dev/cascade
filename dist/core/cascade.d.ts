import type { Provider, ResolveOptions, QueryDef, Fetcher } from './types.js';
export declare class Cascade {
    private readonly providers;
    constructor(providers: Provider[]);
    resolve<TParams, TResult>(query: QueryDef<TParams, TResult>, params: TParams, fetcher: Fetcher<TParams, TResult>, options?: ResolveOptions): Promise<TResult>;
    private revalidate;
    private populate;
}
