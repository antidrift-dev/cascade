import { P as Provider, C as CacheEntry } from '../types-BWzYgGdF.js';

declare class CfCacheProvider implements Provider {
    readonly name = "cf-cache";
    get<T>(key: string): Promise<CacheEntry<T> | null>;
    invalidate(key: string): Promise<void>;
    put<T>(key: string, entry: CacheEntry<T>, ttl?: number): Promise<void>;
}

export { CfCacheProvider };
