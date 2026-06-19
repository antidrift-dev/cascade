import { describe, it, expect, vi } from 'vitest';
import { SqlExecutor } from '../../executors/sql.js';
import type { D1Provider } from '../../providers/d1.js';
import type { QueryState } from '../../executor.js';

// ── fixtures ────────────────────────────────────────────────────────────────

const tableDef = {
  table: 'pagespeed_metrics',
  path: 'trend/pagespeed',
  columns: {
    pageId:       { col: 'page_id',          type: 'text'   as const },
    crawledAt:    { col: 'crawled_at',        type: 'text'   as const },
    broadbandLcp: { col: 'broadband_lcp_ms',  type: 'number' as const },
    totalBytes:   { col: 'total_bytes',       type: 'number' as const },
  },
};

function makeD1(rows: unknown[] = []) {
  return { query: vi.fn().mockResolvedValue(rows) } as unknown as D1Provider;
}

function state(overrides: Partial<QueryState> = {}): QueryState {
  return { tableDef, filters: {}, ...overrides };
}

function getCall(d1: D1Provider, callIdx = 0): [string, unknown[]] {
  return (d1.query as ReturnType<typeof vi.fn>).mock.calls[callIdx] as [string, unknown[]];
}

// ── find: SELECT column projection ──────────────────────────────────────────

describe('SqlExecutor.find', () => {
  it('selects all columns when none specified', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state());
    const [sql] = getCall(d1);
    expect(sql).toContain('page_id, crawled_at, broadband_lcp_ms, total_bytes');
  });

  it('selects only requested columns via select', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ select: ['broadbandLcp'] }));
    const [sql] = getCall(d1);
    expect(sql).toContain('broadband_lcp_ms');
    expect(sql).not.toContain('total_bytes');
    expect(sql).not.toContain('page_id');
  });

  it('select with two columns includes exactly those two in the SELECT list', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ select: ['pageId', 'totalBytes'] }));
    const [sql] = getCall(d1);
    // The SELECT clause should contain the two requested cols
    expect(sql).toContain('page_id');
    expect(sql).toContain('total_bytes');
    // broadband_lcp_ms should not appear anywhere
    expect(sql).not.toContain('broadband_lcp_ms');
    // crawled_at appears in ORDER BY but NOT in the SELECT list
    const selectPart = sql.slice(0, sql.indexOf('FROM'));
    expect(selectPart).not.toContain('crawled_at');
  });

  // ── find: WHERE conditions ─────────────────────────────────────────────────

  it('no filters + no since → no WHERE clause at all', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state());
    const [sql] = getCall(d1);
    expect(sql).not.toContain('WHERE');
  });

  it('maps filter keys to SQL column names', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ filters: { pageId: 'abc' } }));
    const [sql, params] = getCall(d1);
    expect(sql).toContain('page_id = ?');
    expect(params).toContain('abc');
  });

  it('multiple filters joined with AND', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ filters: { pageId: 'abc', crawledAt: '2024-01-01' } }));
    const [sql, params] = getCall(d1);
    expect(sql).toContain('page_id = ?');
    expect(sql).toContain('crawled_at = ?');
    expect(sql).toContain(' AND ');
    expect(params).toContain('abc');
    expect(params).toContain('2024-01-01');
  });

  it('adds crawled_at >= ? condition when since is set', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ since: 28 }));
    const [sql, params] = getCall(d1);
    expect(sql).toContain('crawled_at >= ?');
    expect(params[0]).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('filter + since → both conditions present', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ filters: { pageId: 'x' }, since: 7 }));
    const [sql, params] = getCall(d1);
    expect(sql).toContain('page_id = ?');
    expect(sql).toContain('crawled_at >= ?');
    expect(params).toContain('x');
  });

  it('since=1 computes a date roughly 1 day ago', async () => {
    const before = Date.now();
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ since: 1 }));
    const after = Date.now();
    const [, params] = getCall(d1);
    const dateParam = new Date(params[0] as string).getTime();
    expect(dateParam).toBeGreaterThanOrEqual(before - 86_400_000 - 100);
    expect(dateParam).toBeLessThanOrEqual(after - 86_400_000 + 100);
  });

  it('undefined filter values are skipped', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ filters: { pageId: undefined } }));
    const [sql, params] = getCall(d1);
    expect(sql).not.toContain('page_id = ?');
    expect(params).toHaveLength(0);
  });

  it('unknown filter keys are silently ignored (SQL injection protection)', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ filters: { unknown: 'DROP TABLE pagespeed_metrics' } }));
    const [sql, params] = getCall(d1);
    expect(sql).not.toContain('unknown');
    expect(sql).not.toContain('DROP');
    expect(params).toHaveLength(0);
  });

  it('mix of valid and unknown filters — only valid keys emit conditions', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state({ filters: { pageId: 'ok', evil: 'bad' } }));
    const [sql, params] = getCall(d1);
    expect(sql).toContain('page_id = ?');
    expect(sql).not.toContain('evil');
    expect(params).toEqual(['ok']);
  });

  // ── find: ORDER BY ─────────────────────────────────────────────────────────

  it('orders by crawled_at ASC', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state());
    const [sql] = getCall(d1);
    expect(sql).toContain('ORDER BY crawled_at ASC');
  });

  it('table name appears in FROM clause', async () => {
    const d1 = makeD1();
    await new SqlExecutor(d1).find(state());
    const [sql] = getCall(d1);
    expect(sql).toContain('FROM pagespeed_metrics');
  });

  // ── find: return value ─────────────────────────────────────────────────────

  it('result rows returned as-is from D1', async () => {
    const rows = [{ page_id: 'abc', broadband_lcp_ms: 1200 }];
    const d1 = makeD1(rows);
    const result = await new SqlExecutor(d1).find(state());
    expect(result).toEqual(rows);
  });

  it('returns empty array when D1 returns empty array', async () => {
    const d1 = makeD1([]);
    const result = await new SqlExecutor(d1).find(state());
    expect(result).toEqual([]);
  });
});

// ── stats ────────────────────────────────────────────────────────────────────

describe('SqlExecutor.stats', () => {
  it('generates percentile query for known column', async () => {
    const d1 = makeD1([{ min: 900, max: 1500, p50: 1100, p90: 1400, p95: 1450 }]);
    const result = await new SqlExecutor(d1).stats(state(), 'broadbandLcp');
    const [sql] = getCall(d1);
    expect(sql).toContain('broadband_lcp_ms');
    expect(sql).toContain('p50');
    expect(result.p50).toBe(1100);
  });

  it('throws for unknown column', async () => {
    const d1 = makeD1();
    await expect(new SqlExecutor(d1).stats(state(), 'bogus')).rejects.toThrow('Unknown column');
  });

  it('SQL uses ROW_NUMBER() OVER (ORDER BY col)', async () => {
    const d1 = makeD1([]);
    await new SqlExecutor(d1).stats(state(), 'broadbandLcp').catch(() => {});
    const [sql] = getCall(d1);
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain('ORDER BY broadband_lcp_ms');
  });

  it('SQL uses CAST with percentile multiplier', async () => {
    const d1 = makeD1([]);
    await new SqlExecutor(d1).stats(state(), 'broadbandLcp').catch(() => {});
    const [sql] = getCall(d1);
    expect(sql).toContain('CAST(total * 0.5');
    expect(sql).toContain('CAST(total * 0.9');
    expect(sql).toContain('CAST(total * 0.95');
  });

  it('includes col IS NOT NULL condition', async () => {
    const d1 = makeD1([]);
    await new SqlExecutor(d1).stats(state(), 'broadbandLcp').catch(() => {});
    const [sql] = getCall(d1);
    expect(sql).toContain('broadband_lcp_ms IS NOT NULL');
  });

  it('includes filter conditions in stats query', async () => {
    const d1 = makeD1([]);
    await new SqlExecutor(d1).stats(state({ filters: { pageId: 'p1' } }), 'broadbandLcp').catch(() => {});
    const [sql, params] = getCall(d1);
    expect(sql).toContain('page_id = ?');
    expect(params).toContain('p1');
  });

  it('includes since condition in stats query', async () => {
    const d1 = makeD1([]);
    await new SqlExecutor(d1).stats(state({ since: 30 }), 'broadbandLcp').catch(() => {});
    const [sql, params] = getCall(d1);
    expect(sql).toContain('crawled_at >= ?');
    expect(params[0]).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('returns null fields when D1 returns empty array', async () => {
    const d1 = makeD1([]);
    const result = await new SqlExecutor(d1).stats(state(), 'broadbandLcp');
    expect(result).toEqual({ min: null, max: null, p50: null, p90: null, p95: null });
  });

  it('returns the full stats object from D1 row', async () => {
    const statsRow = { min: 100, max: 2000, p50: 800, p90: 1500, p95: 1800 };
    const d1 = makeD1([statsRow]);
    const result = await new SqlExecutor(d1).stats(state(), 'totalBytes');
    expect(result).toEqual(statsRow);
  });
});
