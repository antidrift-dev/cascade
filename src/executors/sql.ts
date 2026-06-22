import type { Executor, QueryState, WriteState, UpdateState, Stats, Queryable } from '../executor.js';
import type { TableDef } from '../schema.js';

const INSERT_BATCH = 10;

export class SqlExecutor implements Executor {
  constructor(private readonly d1: Queryable) {}

  async find<T>(state: QueryState): Promise<T[]> {
    const { sql, params } = buildSelect(state);
    return this.d1.query<T>(sql, params);
  }

  async count(state: QueryState): Promise<number> {
    const { sql, params } = buildCount(state);
    const rows = await this.d1.query<{ total: number }>(sql, params);
    return rows[0]?.total ?? 0;
  }

  async insert<T extends Record<string, unknown>>(tableDef: TableDef, rows: T[]): Promise<void> {
    if (rows.length === 0) return;
    const { table, columns } = tableDef;
    const schemaKeys = Object.keys(columns);
    const sqlCols = schemaKeys.map(k => columns[k]!.col);

    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const chunk = rows.slice(i, i + INSERT_BATCH);
      const placeholders = chunk.map(() => `(${sqlCols.map(() => '?').join(',')})`).join(',');
      const params: unknown[] = [];
      for (const row of chunk) {
        for (const k of schemaKeys) params.push(row[k] ?? null);
      }
      await this.d1.query(
        `INSERT OR REPLACE INTO ${table} (${sqlCols.join(',')}) VALUES ${placeholders}`,
        params,
      );
    }
  }

  async update(state: UpdateState): Promise<void> {
    const { table, columns } = state.tableDef;
    const setClauses: string[] = [];
    const params: unknown[] = [];

    for (const [key, val] of Object.entries(state.data)) {
      const col = columns[key]?.col;
      if (!col || val === undefined) continue;
      setClauses.push(`${col} = ?`);
      params.push(val);
    }

    if (setClauses.length === 0) return;

    const conditions: string[] = [];
    for (const [key, val] of Object.entries(state.filters)) {
      const col = columns[key]?.col;
      if (!col || val === undefined) continue;
      conditions.push(`${col} = ?`);
      params.push(val);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    await this.d1.query(`UPDATE ${table} SET ${setClauses.join(', ')} ${where}`, params);
  }

  async deleteWhere(state: WriteState): Promise<void> {
    const { table, columns } = state.tableDef;
    const conditions: string[] = [];
    const params: unknown[] = [];
    for (const [key, val] of Object.entries(state.filters)) {
      const col = columns[key]?.col;
      if (!col || val === undefined) continue;
      conditions.push(`${col} = ?`);
      params.push(val);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    await this.d1.query(`DELETE FROM ${table} ${where}`, params);
  }

  async stats(state: QueryState, col: string): Promise<Stats> {
    const sqlCol = state.tableDef.columns[col]?.col;
    if (!sqlCol) throw new Error(`Unknown column: ${col}`);
    const { sql, params } = buildStats(state, sqlCol);
    const rows = await this.d1.query<Stats>(sql, params);
    return rows[0] ?? { min: null, max: null, p50: null, p90: null, p95: null };
  }
}

function buildWhere(state: QueryState): { conditions: string[]; params: unknown[] } {
  const { tableDef, filters, since } = state;
  const { columns } = tableDef;
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const [key, val] of Object.entries(filters)) {
    const sqlCol = columns[key]?.col;
    if (!sqlCol || val === undefined) continue;
    if (val === null) {
      conditions.push(`${sqlCol} IS NULL`);
    } else {
      conditions.push(`${sqlCol} = ?`);
      params.push(val);
    }
  }

  if (since) {
    conditions.push('crawled_at >= ?');
    params.push(new Date(Date.now() - since * 86_400_000).toISOString());
  }

  return { conditions, params };
}

function buildSelect(state: QueryState): { sql: string; params: unknown[] } {
  const { tableDef, select, limit, offset, orderBy } = state;
  const { table, columns } = tableDef;

  const cols = select
    ? select.filter(k => !!columns[k]).map(k => `${columns[k]!.col} AS ${k}`)
    : Object.entries(columns).map(([k, def]) => def.col === k ? def.col : `${def.col} AS ${k}`);

  const { conditions, params } = buildWhere(state);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const order = orderBy
    ? `ORDER BY ${columns[orderBy.col]?.col ?? orderBy.col} ${orderBy.dir ?? 'ASC'}`
    : '';

  const pagination = limit != null ? `LIMIT ${limit}${offset != null ? ` OFFSET ${offset}` : ''}` : '';

  return { sql: `SELECT ${cols.join(', ')} FROM ${table} ${where} ${order} ${pagination}`.trimEnd(), params };
}

function buildCount(state: QueryState): { sql: string; params: unknown[] } {
  const { tableDef } = state;
  const { conditions, params } = buildWhere(state);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { sql: `SELECT COUNT(*) AS total FROM ${tableDef.table} ${where}`.trimEnd(), params };
}

function buildStats(state: QueryState, sqlCol: string): { sql: string; params: unknown[] } {
  const { tableDef, filters, since } = state;
  const { table, columns } = tableDef;

  const conditions: string[] = [`${sqlCol} IS NOT NULL`];
  const params: unknown[] = [];

  for (const [key, val] of Object.entries(filters)) {
    const col = columns[key]?.col;
    if (!col || val === undefined) continue;
    conditions.push(`${col} = ?`);
    params.push(val);
  }

  if (since) {
    conditions.push('crawled_at >= ?');
    params.push(new Date(Date.now() - since * 86_400_000).toISOString());
  }

  const sql = `
    WITH ordered AS (
      SELECT ${sqlCol},
        ROW_NUMBER() OVER (ORDER BY ${sqlCol}) AS rn,
        COUNT(*) OVER () AS total
      FROM ${table} WHERE ${conditions.join(' AND ')}
    )
    SELECT
      MIN(${sqlCol}) AS min, MAX(${sqlCol}) AS max,
      MAX(CASE WHEN rn <= CAST(total * 0.5 + 0.5 AS INTEGER) THEN ${sqlCol} END) AS p50,
      MAX(CASE WHEN rn <= CAST(total * 0.9 + 0.5 AS INTEGER) THEN ${sqlCol} END) AS p90,
      MAX(CASE WHEN rn <= CAST(total * 0.95 + 0.5 AS INTEGER) THEN ${sqlCol} END) AS p95
    FROM ordered
  `;

  return { sql, params };
}
