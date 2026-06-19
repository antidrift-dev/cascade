import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UrlExecutor } from '../../executors/url.js';
import type { QueryState } from '../../executor.js';

// ── fixtures ────────────────────────────────────────────────────────────────

const BASE = 'https://w16.cdn.probeo.io/bizee-XXX/bizee.com';

const tableDef = {
  table: 'pagespeed_metrics',
  path: 'trend/pagespeed',
  columns: {
    pageId:       { col: 'page_id',          type: 'text'   as const },
    broadbandLcp: { col: 'broadband_lcp_ms',  type: 'number' as const },
    totalBytes:   { col: 'total_bytes',       type: 'number' as const },
  },
};

function state(overrides: Partial<QueryState> = {}): QueryState {
  return { tableDef, filters: {}, ...overrides };
}

function mockFetch(data: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(data) });
}

function getUrl(fetchMock: ReturnType<typeof vi.fn>, callIdx = 0): string {
  return (fetchMock.mock.calls[callIdx] as [string])[0];
}

beforeEach(() => { vi.unstubAllGlobals(); });

// ── find: URL structure ──────────────────────────────────────────────────────

describe('UrlExecutor.find', () => {
  it('base + path combined correctly', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(state());
    expect(getUrl(fetch)).toContain(`${BASE}/trend/pagespeed`);
  });

  it('builds URL with table path', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(state());
    expect(getUrl(fetch)).toContain('trend/pagespeed');
  });

  it('no params → URL still contains the path (question mark present from URLSearchParams)', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(state());
    const url = getUrl(fetch);
    // base path is present
    expect(url).toContain(`${BASE}/trend/pagespeed`);
    // no actual filter params
    expect(url).not.toContain('pageId');
    expect(url).not.toContain('days');
    expect(url).not.toContain('cols');
  });

  it('serializes filters as query params', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(state({ filters: { pageId: 'abc123' } }));
    expect(getUrl(fetch)).toContain('pageId=abc123');
  });

  it('multiple filters all appear in URL', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(state({ filters: { pageId: 'p1', broadbandLcp: 900 } }));
    const url = getUrl(fetch);
    expect(url).toContain('pageId=p1');
    expect(url).toContain('broadbandLcp=900');
  });

  it('serializes since as days param', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(state({ since: 28 }));
    expect(getUrl(fetch)).toContain('days=28');
  });

  it('serializes select as cols param (comma-separated)', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(state({ select: ['broadbandLcp', 'totalBytes'] }));
    // URLSearchParams encodes comma as %2C
    expect(getUrl(fetch)).toMatch(/cols=broadbandLcp[%,]2?C?totalBytes/);
  });

  it('single select col → cols= with just that key', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(state({ select: ['pageId'] }));
    expect(getUrl(fetch)).toContain('cols=pageId');
  });

  it('all three params together — filter + since + select', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(
      state({ filters: { pageId: 'p1' }, since: 14, select: ['broadbandLcp'] }),
    );
    const url = getUrl(fetch);
    expect(url).toContain('pageId=p1');
    expect(url).toContain('days=14');
    expect(url).toContain('cols=broadbandLcp');
  });

  it('undefined filter values are omitted from URL', async () => {
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).find(state({ filters: { pageId: undefined } }));
    expect(getUrl(fetch)).not.toContain('pageId');
  });

  // ── find: response handling ────────────────────────────────────────────────

  it('returns parsed JSON body', async () => {
    const rows = [{ broadbandLcp: 1200 }];
    vi.stubGlobal('fetch', mockFetch(rows));
    const result = await new UrlExecutor(BASE).find(state());
    expect(result).toEqual(rows);
  });

  it('throws on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(new UrlExecutor(BASE).find(state())).rejects.toThrow('404');
  });

  it('throws on 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(new UrlExecutor(BASE).find(state())).rejects.toThrow('500');
  });

  it('error message includes the table path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(new UrlExecutor(BASE).find(state())).rejects.toThrow('trend/pagespeed');
  });

  it('uses correct base URL when different base is supplied', async () => {
    const altBase = 'https://cdn.example.com/acme-123/acme.com';
    const fetch = mockFetch([]);
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(altBase).find(state());
    expect(getUrl(fetch)).toContain(altBase);
  });
});

// ── stats ────────────────────────────────────────────────────────────────────

describe('UrlExecutor.stats', () => {
  it('adds agg=stats and col params', async () => {
    const fetch = mockFetch({ p50: 1100, p90: 1400, p95: 1450, min: 900, max: 1500 });
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).stats(state(), 'broadbandLcp');
    const url = getUrl(fetch);
    expect(url).toContain('agg=stats');
    expect(url).toContain('col=broadbandLcp');
  });

  it('col= is the schema key name (not SQL col name)', async () => {
    const fetch = mockFetch({ p50: 1, p90: 2, p95: 3, min: 0, max: 5 });
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).stats(state(), 'totalBytes');
    const url = getUrl(fetch);
    expect(url).toContain('col=totalBytes');
    expect(url).not.toContain('total_bytes');
  });

  it('filters still included in stats URL', async () => {
    const fetch = mockFetch({ p50: 1, p90: 2, p95: 3, min: 0, max: 5 });
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).stats(state({ filters: { pageId: 'myPage' } }), 'broadbandLcp');
    expect(getUrl(fetch)).toContain('pageId=myPage');
  });

  it('since still included in stats URL', async () => {
    const fetch = mockFetch({ p50: 1, p90: 2, p95: 3, min: 0, max: 5 });
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).stats(state({ since: 90 }), 'broadbandLcp');
    expect(getUrl(fetch)).toContain('days=90');
  });

  it('returns parsed JSON response body for stats', async () => {
    const statsBody = { p50: 1100, p90: 1400, p95: 1450, min: 900, max: 1500 };
    vi.stubGlobal('fetch', mockFetch(statsBody));
    const result = await new UrlExecutor(BASE).stats(state(), 'broadbandLcp');
    expect(result).toEqual(statsBody);
  });

  it('throws on non-ok stats response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(new UrlExecutor(BASE).stats(state(), 'broadbandLcp')).rejects.toThrow('503');
  });

  it('path included in stats URL', async () => {
    const fetch = mockFetch({ p50: 1, p90: 2, p95: 3, min: 0, max: 5 });
    vi.stubGlobal('fetch', fetch);
    await new UrlExecutor(BASE).stats(state(), 'broadbandLcp');
    expect(getUrl(fetch)).toContain('trend/pagespeed');
  });
});
