import { P as Provider, C as CacheEntry } from '../types-BWzYgGdF.js';

type DexieTable = {
    get(key: string): Promise<(CacheEntry<unknown> & {
        key: string;
    }) | undefined>;
    put(value: CacheEntry<unknown> & {
        key: string;
    }): Promise<unknown>;
};
declare class IndexedDbProvider implements Provider {
    private readonly table;
    readonly name = "indexeddb";
    constructor(table: DexieTable);
    get<T>(key: string): Promise<CacheEntry<T> | null>;
    put<T>(key: string, entry: CacheEntry<T>): Promise<void>;
}

export { IndexedDbProvider };
