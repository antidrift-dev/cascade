import type { Provider, CacheEntry } from '../core/types.js';
export declare class D1Provider implements Provider {
    private readonly accountId;
    private readonly databaseId;
    private readonly token;
    readonly name = "d1";
    constructor(accountId: string, databaseId: string, token: string);
    get<T>(_key: string): Promise<CacheEntry<T> | null>;
    put<T>(_key: string, _entry: CacheEntry<T>): Promise<void>;
    query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
