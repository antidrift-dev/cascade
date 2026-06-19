import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cascade } from '../core/cascade.js';
import type { Provider, CacheEntry, QueryDef, Fetcher } from '../core/types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeEntry<T>(data: T, etag = 'etag-1', cachedAt = Date.now()): CacheEntry<T> {
  return { data, etag, cachedAt };
}

/** A provider that always misses */
function missProvider(name = 'miss'): Provider {
  return {
    name,
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
  };
}

/** A provider that always hits with the given entry */
function hitProvider<T>(entry: CacheEntry<T>, name = 'hit'): Provider {
  return {
    name,
    get: vi.fn().mockResolvedValue(entry),
    put: vi.fn().mockResolvedValue(undefined),
  };
}

function query<P, R>(keyFn?: (p: P) => string): QueryDef<P, R> {
  return { key: keyFn ?? ((p) => JSON.stringify(p)) };
}

function fetcher<P, R>(data: R, etag = 'etag-fresh'): Fetcher<P, R> {
  return vi.fn().mockResolvedValue({ data, etag });
}

/** Flush all microtasks / promises that have already been queued */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ── basic resolution ─────────────────────────────────────────────────────────

describe('Cascade.resolve', () => {
  it('returns data from first provider that hits', async () => {
    const entry = makeEntry({ value: 42 }, 'e1');
    const cascade = new Cascade([hitProvider(entry, 'p1'), missProvider('p2')]);
    const result = await cascade.resolve(
      query(),
      {},
      fetcher({ value: 0 }),
      { staleWhileRevalidate: false },
    );
    expect(result).toEqual({ value: 42 });
  });

  it('skips miss providers and hits second provider', async () => {
    const entry = makeEntry({ value: 99 }, 'e2');
    const cascade = new Cascade([missProvider('p1'), hitProvider(entry, 'p2')]);
    const result = await cascade.resolve(
      query(),
      {},
      fetcher({ value: 0 }),
      { staleWhileRevalidate: false },
    );
    expect(result).toEqual({ value: 99 });
  });

  it('falls through to fetcher when all providers miss', async () => {
    const fetchFn = fetcher<object, { value: number }>({ value: 7 });
    const cascade = new Cascade([missProvider('p1'), missProvider('p2')]);
    const result = await cascade.resolve(query(), {}, fetchFn);
    expect(result).toEqual({ value: 7 });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('falls through to fetcher when provider list is empty', async () => {
    const fetchFn = fetcher<object, string>('hello');
    const cascade = new Cascade([]);
    const result = await cascade.resolve(query(), {}, fetchFn);
    expect(result).toBe('hello');
  });

  // ── populate after fetch ───────────────────────────────────────────────────

  it('populates all providers after fetcher resolves', async () => {
    const p1 = missProvider('p1');
    const p2 = missProvider('p2');
    const cascade = new Cascade([p1, p2]);
    await cascade.resolve(query(), {}, fetcher({ x: 1 }));
    expect(p1.put).toHaveBeenCalledOnce();
    expect(p2.put).toHaveBeenCalledOnce();
  });

  it('populate calls put with correct key', async () => {
    const p1 = missProvider('p1');
    const cascade = new Cascade([p1]);
    const q = query<{ id: string }, string>((p) => `key:${p.id}`);
    await cascade.resolve(q, { id: 'abc' }, fetcher('result'));
    expect(p1.put).toHaveBeenCalledWith(
      'key:abc',
      expect.objectContaining({ data: 'result', etag: 'etag-fresh' }),
      expect.any(Number),
    );
  });

  it('populate uses default ttl of 300', async () => {
    const p1 = missProvider('p1');
    const cascade = new Cascade([p1]);
    await cascade.resolve(query(), {}, fetcher('data'));
    const [, , ttl] = (p1.put as ReturnType<typeof vi.fn>).mock.calls[0] as [string, CacheEntry<string>, number];
    expect(ttl).toBe(300);
  });

  it('populate uses custom ttl when provided', async () => {
    const p1 = missProvider('p1');
    const cascade = new Cascade([p1]);
    await cascade.resolve(query(), {}, fetcher('data'), { ttl: 60 });
    const [, , ttl] = (p1.put as ReturnType<typeof vi.fn>).mock.calls[0] as [string, CacheEntry<string>, number];
    expect(ttl).toBe(60);
  });

  // ── staleWhileRevalidate=false ─────────────────────────────────────────────

  it('staleWhileRevalidate=false: returns cached data immediately', async () => {
    const entry = makeEntry('cached', 'e1');
    const fetchFn = fetcher<object, string>('fresh');
    const cascade = new Cascade([hitProvider(entry)]);
    const result = await cascade.resolve(query(), {}, fetchFn, { staleWhileRevalidate: false });
    expect(result).toBe('cached');
  });

  it('staleWhileRevalidate=false: does NOT call fetcher', async () => {
    const entry = makeEntry('cached', 'e1');
    const fetchFn = fetcher<object, string>('fresh');
    const cascade = new Cascade([hitProvider(entry)]);
    await cascade.resolve(query(), {}, fetchFn, { staleWhileRevalidate: false });
    await flushPromises();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  // ── staleWhileRevalidate=true ──────────────────────────────────────────────

  it('staleWhileRevalidate=true: returns cached data immediately (before revalidation)', async () => {
    const entry = makeEntry('stale', 'e-old');
    const fetchFn = fetcher<object, string>('fresh', 'e-new');
    const cascade = new Cascade([hitProvider(entry)]);
    const result = await cascade.resolve(query(), {}, fetchFn, { staleWhileRevalidate: true });
    // Should return the stale cached value, not wait for fetch
    expect(result).toBe('stale');
  });

  it('staleWhileRevalidate=true: calls fetcher in background', async () => {
    const entry = makeEntry('stale', 'e-old');
    const fetchFn = fetcher<object, string>('fresh', 'e-new');
    const cascade = new Cascade([hitProvider(entry)]);
    await cascade.resolve(query(), {}, fetchFn, { staleWhileRevalidate: true });
    await flushPromises();
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  // ── revalidate: etag matching ──────────────────────────────────────────────

  it('revalidate skips write-back when etag matches', async () => {
    const entry = makeEntry('data', 'same-etag');
    const p1 = hitProvider(entry, 'p1');
    const fetchFn: Fetcher<object, string> = vi.fn().mockResolvedValue({ data: 'data', etag: 'same-etag' });
    const cascade = new Cascade([p1]);
    await cascade.resolve(query(), {}, fetchFn, { staleWhileRevalidate: true });
    await flushPromises();
    expect(p1.put).not.toHaveBeenCalled();
  });

  it('revalidate writes fresh data when etag differs', async () => {
    const entry = makeEntry('old', 'e-old');
    const p1 = hitProvider(entry, 'p1');
    const fetchFn: Fetcher<object, string> = vi.fn().mockResolvedValue({ data: 'new', etag: 'e-new' });
    const cascade = new Cascade([p1]);
    await cascade.resolve(query(), {}, fetchFn, { staleWhileRevalidate: true });
    await flushPromises();
    expect(p1.put).toHaveBeenCalledOnce();
    const [, written] = (p1.put as ReturnType<typeof vi.fn>).mock.calls[0] as [string, CacheEntry<string>];
    expect(written.data).toBe('new');
    expect(written.etag).toBe('e-new');
  });

  // ── revalidate: only providers at-or-after hit index ──────────────────────

  it('revalidate only populates providers at-or-after the hit index', async () => {
    const entry = makeEntry('stale', 'old');
    const p0 = missProvider('p0');
    const p1 = hitProvider(entry, 'p1');          // hit at index 1
    const p2 = missProvider('p2');
    const fetchFn: Fetcher<object, string> = vi.fn().mockResolvedValue({ data: 'fresh', etag: 'new' });
    const cascade = new Cascade([p0, p1, p2]);
    await cascade.resolve(query(), {}, fetchFn, { staleWhileRevalidate: true });
    await flushPromises();
    // p0 is BEFORE the hit — should not receive a revalidate put
    expect(p0.put).not.toHaveBeenCalled();
    // p1 and p2 are at/after the hit — should receive the fresh entry
    expect(p1.put).toHaveBeenCalledOnce();
    expect(p2.put).toHaveBeenCalledOnce();
  });

  it('revalidate with hit at index 0 updates all providers', async () => {
    const entry = makeEntry('stale', 'old');
    const p0 = hitProvider(entry, 'p0');          // hit at index 0
    const p1 = missProvider('p1');
    const fetchFn: Fetcher<object, string> = vi.fn().mockResolvedValue({ data: 'fresh', etag: 'new' });
    const cascade = new Cascade([p0, p1]);
    await cascade.resolve(query(), {}, fetchFn, { staleWhileRevalidate: true });
    await flushPromises();
    expect(p0.put).toHaveBeenCalledOnce();
    expect(p1.put).toHaveBeenCalledOnce();
  });

  // ── key derivation ─────────────────────────────────────────────────────────

  it('uses query.key to derive the cache key for get', async () => {
    const p1 = missProvider('p1');
    const q = query<{ id: string }, string>((p) => `mykey:${p.id}`);
    const cascade = new Cascade([p1]);
    await cascade.resolve(q, { id: 'z99' }, fetcher('x'));
    expect(p1.get).toHaveBeenCalledWith('mykey:z99');
  });

  it('uses query.key to derive the cache key for put', async () => {
    const p1 = missProvider('p1');
    const q = query<{ id: string }, string>((p) => `mykey:${p.id}`);
    const cascade = new Cascade([p1]);
    await cascade.resolve(q, { id: 'z99' }, fetcher('x'));
    expect(p1.put).toHaveBeenCalledWith('mykey:z99', expect.anything(), expect.any(Number));
  });

  // ── default options ────────────────────────────────────────────────────────

  it('default staleWhileRevalidate is true', async () => {
    const entry = makeEntry('cached', 'e-old');
    const fetchFn: Fetcher<object, string> = vi.fn().mockResolvedValue({ data: 'fresh', etag: 'e-new' });
    const p1 = hitProvider(entry, 'p1');
    const cascade = new Cascade([p1]);
    // No options passed — should default to staleWhileRevalidate=true
    await cascade.resolve(query(), {}, fetchFn);
    await flushPromises();
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('cachedAt is set on populate entry', async () => {
    const before = Date.now();
    const p1 = missProvider('p1');
    const cascade = new Cascade([p1]);
    await cascade.resolve(query(), {}, fetcher('data'));
    const after = Date.now();
    const [, entry] = (p1.put as ReturnType<typeof vi.fn>).mock.calls[0] as [string, CacheEntry<string>];
    expect(entry.cachedAt).toBeGreaterThanOrEqual(before);
    expect(entry.cachedAt).toBeLessThanOrEqual(after);
  });
});
