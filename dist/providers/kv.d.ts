import type { Provider, CacheEntry } from '../core/types.js';
export declare class KvProvider implements Provider {
    private readonly kv;
    readonly name = "kv";
    constructor(kv: KVNamespace);
    get<T>(key: string): Promise<CacheEntry<T> | null>;
    put<T>(key: string, entry: CacheEntry<T>, ttl?: number): Promise<void>;
}
