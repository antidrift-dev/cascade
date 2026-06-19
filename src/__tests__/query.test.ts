import { describe, it, expect, vi } from 'vitest';
import { QueryChain } from '../query.js';
import type { Executor, QueryState, Stats } from '../executor.js';

// ── fixtures ────────────────────────────────────────────────────────────────

const tableDef = {
  table: 'pagespeed_metrics',
  path: 'trend/pagespeed',
  columns: {
    pageId:       { col: 'page_id',         type: 'text'   as const },
    crawledAt:    { col: 'crawled_at',       type: 'text'   as const },
    broadbandLcp: { col: 'broadband_lcp_ms', type: 'number' as const },
  },
};

const altTableDef = {
  table: 'core_web_vitals',
  path: 'trend/vitals',
  columns: {
    pageId: { col: 'page_id', type: 'text'   as const },
    cls:    { col: 'cls',     type: 'real'   as const },
  },
};

const defaultStats: Stats = { min: null, max: null, p50: null, p90: null, p95: null };

function mockExecutor(rows: unknown[] = []) {
  return {
    find:        vi.fn().mockResolvedValue(rows),
    stats:       vi.fn().mockResolvedValue(defaultStats),
    count:       vi.fn().mockResolvedValue(0),
    insert:      vi.fn().mockResolvedValue(undefined),
    update:      vi.fn().mockResolvedValue(undefined),
    deleteWhere: vi.fn().mockResolvedValue(undefined),
  } satisfies Executor;
}

// ── basic state passing ──────────────────────────────────────────────────────

describe('QueryChain', () => {
  it('calls find with empty state by default', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex).fetch();
    expect(ex.find).toHaveBeenCalledWith(
      expect.objectContaining({ filters: {}, since: undefined, select: undefined }),
    );
  });

  it('passes the correct tableDef to find', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex).fetch();
    expect(ex.find).toHaveBeenCalledWith(
      expect.objectContaining({ tableDef }),
    );
  });

  it('passes the correct tableDef to stats', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex).stats('broadbandLcp');
    expect(ex.stats).toHaveBeenCalledWith(
      expect.objectContaining({ tableDef }),
      'broadbandLcp',
    );
  });

  it('where() adds filters to state', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex).where({ pageId: 'abc' }).fetch();
    expect(ex.find).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { pageId: 'abc' } }),
    );
  });

  it('since() adds days to state', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex).since(28).fetch();
    expect(ex.find).toHaveBeenCalledWith(expect.objectContaining({ since: 28 }));
  });

  it('select() adds column list to state', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex).select(['broadbandLcp']).fetch();
    expect(ex.find).toHaveBeenCalledWith(
      expect.objectContaining({ select: ['broadbandLcp'] }),
    );
  });

  // ── multiple where() calls accumulate ──────────────────────────────────────

  it('multiple where() calls accumulate — do not overwrite', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex)
      .where({ pageId: 'abc' })
      .where({ crawledAt: '2024-01-01' })
      .fetch();
    expect(ex.find).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { pageId: 'abc', crawledAt: '2024-01-01' } }),
    );
  });

  it('second where() can override a key set by first', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex)
      .where({ pageId: 'abc' })
      .where({ pageId: 'xyz' })
      .fetch();
    const [state] = (ex.find as ReturnType<typeof vi.fn>).mock.calls[0] as [QueryState];
    expect(state.filters['pageId']).toBe('xyz');
  });

  // ── chaining order ─────────────────────────────────────────────────────────

  it('since() before where() produces same result as where() before since()', async () => {
    const ex1 = mockExecutor();
    const ex2 = mockExecutor();

    await new QueryChain(tableDef, ex1).since(7).where({ pageId: 'p1' }).fetch();
    await new QueryChain(tableDef, ex2).where({ pageId: 'p1' }).since(7).fetch();

    const state1 = (ex1.find as ReturnType<typeof vi.fn>).mock.calls[0][0] as QueryState;
    const state2 = (ex2.find as ReturnType<typeof vi.fn>).mock.calls[0][0] as QueryState;

    expect(state1.filters).toEqual(state2.filters);
    expect(state1.since).toEqual(state2.since);
  });

  it('select() before where() produces same result as where() before select()', async () => {
    const ex1 = mockExecutor();
    const ex2 = mockExecutor();

    await new QueryChain(tableDef, ex1).select(['broadbandLcp']).where({ pageId: 'p' }).fetch();
    await new QueryChain(tableDef, ex2).where({ pageId: 'p' }).select(['broadbandLcp']).fetch();

    const s1 = (ex1.find as ReturnType<typeof vi.fn>).mock.calls[0][0] as QueryState;
    const s2 = (ex2.find as ReturnType<typeof vi.fn>).mock.calls[0][0] as QueryState;

    expect(s1.filters).toEqual(s2.filters);
    expect(s1.select).toEqual(s2.select);
  });

  // ── fresh state per instance ───────────────────────────────────────────────

  it('each new QueryChain starts with empty state', async () => {
    const ex = mockExecutor();
    const chain = new QueryChain(tableDef, ex);
    chain.where({ pageId: 'abc' });
    const fresh = new QueryChain(tableDef, ex);
    await fresh.fetch();
    expect(ex.find).toHaveBeenCalledWith(expect.objectContaining({ filters: {} }));
  });

  it('mutating one chain does not affect another created from same tableDef', async () => {
    const ex = mockExecutor();
    const a = new QueryChain(tableDef, ex).where({ pageId: 'a' });
    const b = new QueryChain(tableDef, ex);
    await b.fetch();
    const stateB = (ex.find as ReturnType<typeof vi.fn>).mock.calls[0][0] as QueryState;
    expect(stateB.filters).toEqual({});
    // now run a to confirm it has its own state
    await a.fetch();
    const stateA = (ex.find as ReturnType<typeof vi.fn>).mock.calls[1][0] as QueryState;
    expect(stateA.filters).toEqual({ pageId: 'a' });
  });

  // ── return value forwarding ────────────────────────────────────────────────

  it('fetch() returns exactly what executor.find returns', async () => {
    const rows = [{ pageId: 'p1', broadbandLcp: 1200 }];
    const ex = mockExecutor(rows);
    const result = await new QueryChain(tableDef, ex).fetch();
    expect(result).toBe(rows); // same reference
  });

  it('stats() returns exactly what executor.stats returns', async () => {
    const stats: Stats = { min: 100, max: 500, p50: 200, p90: 450, p95: 480 };
    const ex = mockExecutor();
    ex.stats.mockResolvedValue(stats);
    const result = await new QueryChain(tableDef, ex).stats('broadbandLcp');
    expect(result).toBe(stats);
  });

  // ── full chain ─────────────────────────────────────────────────────────────

  it('all three modifiers compose correctly in state', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex)
      .where({ pageId: 'abc' })
      .since(28)
      .select(['broadbandLcp'])
      .fetch();

    expect(ex.find).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { pageId: 'abc' },
        since: 28,
        select: ['broadbandLcp'],
      }),
    );
  });

  it('stats() passes full filter state including since', async () => {
    const ex = mockExecutor();
    await new QueryChain(tableDef, ex)
      .where({ pageId: 'abc' })
      .since(14)
      .stats('broadbandLcp');

    expect(ex.stats).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { pageId: 'abc' }, since: 14 }),
      'broadbandLcp',
    );
  });

  it('works with alternate tableDef', async () => {
    const ex = mockExecutor();
    await new QueryChain(altTableDef, ex).fetch();
    expect(ex.find).toHaveBeenCalledWith(
      expect.objectContaining({ tableDef: altTableDef }),
    );
  });
});
