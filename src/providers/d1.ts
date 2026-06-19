import type { Provider, CacheEntry } from '../core/types.js';

// D1 REST provider — key is the full query URL, data is the query result
// This is a write-through provider: get() is a no-op (D1 is the source of truth),
// put() is also a no-op (callers write to D1 directly via the engine).
// The D1 provider is used as a fetcher, not a cache layer.
export class D1Provider implements Provider {
  readonly name = 'd1';

  constructor(
    private readonly accountId: string,
    private readonly databaseId: string,
    private readonly token: string
  ) {}

  async get<T>(_key: string): Promise<CacheEntry<T> | null> {
    return null; // always miss — D1 is queried via query() not get/put
  }

  async put<T>(_key: string, _entry: CacheEntry<T>): Promise<void> {
    // no-op
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) throw new Error(`D1 HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json() as { success: boolean; result: Array<{ results: T[] }>; errors: Array<{ message: string }> };
    if (!data.success) throw new Error(`D1 error: ${data.errors.map(e => e.message).join(', ')}`);
    return data.result[0]?.results ?? [];
  }
}
