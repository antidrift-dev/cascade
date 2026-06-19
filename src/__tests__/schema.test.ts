import { describe, it, expect } from 'vitest';
import { defineSchema } from '../schema.js';
import type { ColType, RowType, ColDef } from '../schema.js';

// ── fixtures ────────────────────────────────────────────────────────────────

const schema = defineSchema({
  pagespeed: {
    table: 'pagespeed_metrics',
    path: 'trend/pagespeed',
    columns: {
      pageId:       { col: 'page_id',          type: 'text'   as const },
      crawledAt:    { col: 'crawled_at',        type: 'text'   as const },
      broadbandLcp: { col: 'broadband_lcp_ms',  type: 'number' as const },
      totalBytes:   { col: 'total_bytes',       type: 'number' as const },
    },
  },
});

const multiSchema = defineSchema({
  pagespeed: {
    table: 'pagespeed_metrics',
    path: 'trend/pagespeed',
    columns: {
      pageId:   { col: 'page_id', type: 'text' as const },
      lcp:      { col: 'lcp_ms',  type: 'number' as const },
    },
  },
  vitals: {
    table: 'core_web_vitals',
    path: 'trend/vitals',
    columns: {
      pageId: { col: 'page_id', type: 'text'   as const },
      fid:    { col: 'fid_ms',  type: 'number' as const },
      cls:    { col: 'cls',     type: 'real'   as const },
    },
  },
});

const realSchema = defineSchema({
  scores: {
    table: 'scores',
    path: 'trend/scores',
    columns: {
      ratio: { col: 'ratio', type: 'real' as const },
      label: { col: 'label', type: 'text' as const },
    },
  },
});

const specialSchema = defineSchema({
  weird: {
    table: 'weird_table',
    path: 'data/weird',
    columns: {
      'my-col':    { col: 'my_col',    type: 'text'   as const },
      'val_score': { col: 'val_score', type: 'number' as const },
    },
  },
});

// ── defineSchema identity ────────────────────────────────────────────────────

describe('defineSchema', () => {
  it('returns schema unchanged', () => {
    expect(schema.pagespeed.table).toBe('pagespeed_metrics');
    expect(schema.pagespeed.path).toBe('trend/pagespeed');
    expect(schema.pagespeed.columns.pageId.col).toBe('page_id');
    expect(schema.pagespeed.columns.broadbandLcp.type).toBe('number');
  });

  it('preserves column sql name (col)', () => {
    expect(schema.pagespeed.columns.crawledAt.col).toBe('crawled_at');
    expect(schema.pagespeed.columns.totalBytes.col).toBe('total_bytes');
  });

  it('preserves text column type', () => {
    expect(schema.pagespeed.columns.pageId.type).toBe('text');
    expect(schema.pagespeed.columns.crawledAt.type).toBe('text');
  });

  it('preserves number column type', () => {
    expect(schema.pagespeed.columns.broadbandLcp.type).toBe('number');
    expect(schema.pagespeed.columns.totalBytes.type).toBe('number');
  });

  it('preserves real column type', () => {
    expect(realSchema.scores.columns.ratio.type).toBe('real');
  });

  it('preserves table with multiple tables — first table intact', () => {
    expect(multiSchema.pagespeed.table).toBe('pagespeed_metrics');
    expect(multiSchema.pagespeed.path).toBe('trend/pagespeed');
  });

  it('preserves table with multiple tables — second table intact', () => {
    expect(multiSchema.vitals.table).toBe('core_web_vitals');
    expect(multiSchema.vitals.path).toBe('trend/vitals');
  });

  it('second table columns are accessible', () => {
    expect(multiSchema.vitals.columns.fid.col).toBe('fid_ms');
    expect(multiSchema.vitals.columns.cls.type).toBe('real');
  });

  it('all ColTypes present in schema columns', () => {
    const types = Object.values(multiSchema.vitals.columns).map(c => c.type) as ColType[];
    expect(types).toContain('text');
    expect(types).toContain('number');
    expect(types).toContain('real');
  });

  it('column keys with special characters in schema key name are preserved', () => {
    expect(specialSchema.weird.columns['my-col'].col).toBe('my_col');
    expect(specialSchema.weird.columns['val_score'].col).toBe('val_score');
  });

  it('column objects have exactly col and type', () => {
    const col: ColDef = schema.pagespeed.columns.pageId;
    expect(Object.keys(col).sort()).toEqual(['col', 'type'].sort());
  });

  it('multiple tables do not share column references', () => {
    // mutating vitals columns does not affect pagespeed columns
    const original = multiSchema.pagespeed.columns.pageId.col;
    expect(multiSchema.vitals.columns.pageId.col).toBe('page_id');
    expect(multiSchema.pagespeed.columns.pageId.col).toBe(original);
  });

  it('returns the same object reference (no deep copy)', () => {
    const raw = {
      t: { table: 'x', path: 'y', columns: { a: { col: 'a', type: 'text' as const } } },
    };
    const defined = defineSchema(raw);
    expect(defined).toBe(raw);
  });
});
