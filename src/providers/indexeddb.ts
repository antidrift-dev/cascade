import type { Provider, CacheEntry } from '../core/types.js';

// Dexie is a peer dependency — only used in browser context
type DexieTable = {
  get(key: string): Promise<(CacheEntry<unknown> & { key: string }) | undefined>;
  put(value: CacheEntry<unknown> & { key: string }): Promise<unknown>;
};

export class IndexedDbProvider implements Provider {
  readonly name = 'indexeddb';

  constructor(private readonly table: DexieTable) {}

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = await this.table.get(key);
    if (!entry) return null;
    return { data: entry.data as T, etag: entry.etag, cachedAt: entry.cachedAt };
  }

  async put<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    await this.table.put({ key, ...entry });
  }
}
