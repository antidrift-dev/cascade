import type { Provider, CacheEntry } from '../core/types.js';

interface KvEntry<T> {
  data: T;
  etag: string;
  cachedAt: number;
}

export class KvProvider implements Provider {
  readonly name = 'kv';

  constructor(private readonly kv: KVNamespace) {}

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const entry = await this.kv.get<KvEntry<T>>(key, 'json');
    if (!entry) return null;
    return entry;
  }

  async put<T>(key: string, entry: CacheEntry<T>, ttl = 300): Promise<void> {
    await this.kv.put(key, JSON.stringify(entry), { expirationTtl: ttl });
  }
}
