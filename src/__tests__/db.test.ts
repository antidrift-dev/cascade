import { describe, it, expect, vi } from 'vitest';
import { createDb } from '../db.js';
import { QueryChain } from '../query.js';
import type { Executor, QueryState, Stats } from '../executor.js';

// ── fixtures ────────────────────────────────────────────────────────────────

const singleSchema = {
  pagespeed: {
    table: 'pagespeed_metrics',
    path: 'trend/pagespeed',
    columns: {
      pageId:   { col: 'page_id',         type: 'text'   as const },
      lcp:      { col: 'broadband_lcp_ms', type: 'number' as const },
    },
  },
};

const twoTableSchema = {
  pagespeed: {
    table: 'pagespeed_metrics',
    path: 'trend/pagespeed',
    columns: {
      pageId: { col: 'page_id', type: 'text'   as const },
      lcp:    { col: 'lcp_ms',  type: 'number' as const },
    },
  },
  vitals: {
    table: 'core_web_vitals',
    path: 'trend/vitals',
    columns: {
      pageId: { col: 'page_id', type: 'text'   as const },
      cls:    { col: 'cls',     type: 'real'   as const },
    },
  },
};

function mockExecutor(rows: unknown[] = []): Executor {
  return {
    find:        vi.fn().mockResolvedValue(rows),
    stats:       vi.fn().mockResolvedValue({ min: null, max: null, p50: null, p90: null, p95: null } satisfies Stats),
    count:       vi.fn().mockResolvedValue(0),
    insert:      vi.fn().mockResolvedValue(undefined),
    update:      vi.fn().mockResolvedValue(undefined),
    deleteWhere: vi.fn().mockResolvedValue(undefined),
  };
}

// ── structure ────────────────────────────────────────────────────────────────

describe('createDb', () => {
  it('returns an object with all schema table keys', () => {
    const db = createDb(twoTableSchema, mockExecutor());
    expect('pagespeed' in db).toBe(true);
    expect('vitals' in db).toBe(true);
  });

  it('does not expose keys not in schema', () => {
    const db = createDb(singleSchema, mockExecutor());
    expect('vitals' in db).toBe(false);
  });

  it('two-table schema — both keys accessible', () => {
    const db = createDb(twoTableSchema, mockExecutor());
    expect(db.pagespeed).toBeInstanceOf(QueryChain);
    expect(db.vitals).toBeInstanceOf(QueryChain);
  });

  it('single-table schema — key accessible', () => {
    const db = createDb(singleSchema, mockExecutor());
    expect(db.pagespeed).toBeInstanceOf(QueryChain);
  });

  // ── QueryChain instances ──────────────────────────────────────────────────

  it('each property access creates a FRESH QueryChain (no state leak)', async () => {
    const ex = mockExecutor();
    const db = createDb(singleSchema, ex);

    // Modify one instance
    const chain1 = db.pagespeed;
    chain1.where({ pageId: 'abc' });

    // Access again — should get a fresh chain
    const chain2 = db.pagespeed;
    await chain2.fetch();

    const [state] = (ex.find as ReturnType<typeof vi.fn>).mock.calls[0] as [QueryState];
    expect(state.filters).toEqual({});
  });

  it('two consecutive accesses return different object references', () => {
    const db = createDb(singleSchema, mockExecutor());
    expect(db.pagespeed).not.toBe(db.pagespeed);
  });

  it('QueryChain is wired to the executor — fetch calls executor.find', async () => {
    const ex = mockExecutor([{ pageId: 'p1' }]);
    const db = createDb(singleSchema, ex);
    const result = await db.pagespeed.fetch();
    expect(ex.find).toHaveBeenCalledOnce();
    expect(result).toEqual([{ pageId: 'p1' }]);
  });

  it('QueryChain for different tables hit executor independently', async () => {
    const ex = mockExecutor();
    const db = createDb(twoTableSchema, ex);
    await db.pagespeed.fetch();
    await db.vitals.fetch();
    expect((ex.find as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('chain from first table carries correct tableDef', async () => {
    const ex = mockExecutor();
    const db = createDb(twoTableSchema, ex);
    await db.pagespeed.fetch();
    const [state] = (ex.find as ReturnType<typeof vi.fn>).mock.calls[0] as [QueryState];
    expect(state.tableDef).toBe(twoTableSchema.pagespeed);
  });

  it('chain from second table carries correct tableDef', async () => {
    const ex = mockExecutor();
    const db = createDb(twoTableSchema, ex);
    await db.vitals.fetch();
    const [state] = (ex.find as ReturnType<typeof vi.fn>).mock.calls[0] as [QueryState];
    expect(state.tableDef).toBe(twoTableSchema.vitals);
  });

  it('where() + fetch() through createDb flows correctly', async () => {
    const ex = mockExecutor();
    const db = createDb(singleSchema, ex);
    await db.pagespeed.where({ pageId: 'test-page' }).since(14).fetch();
    const [state] = (ex.find as ReturnType<typeof vi.fn>).mock.calls[0] as [QueryState];
    expect(state.filters).toEqual({ pageId: 'test-page' });
    expect(state.since).toBe(14);
  });

  it('stats() through createDb flows correctly', async () => {
    const ex = mockExecutor();
    const db = createDb(singleSchema, ex);
    await db.pagespeed.stats('lcp');
    expect(ex.stats).toHaveBeenCalledWith(
      expect.objectContaining({ tableDef: singleSchema.pagespeed }),
      'lcp',
    );
  });
});
