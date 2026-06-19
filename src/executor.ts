import type { TableDef } from './schema.js';

export interface QueryState {
  tableDef: TableDef;
  filters: Record<string, unknown>;
  since?: number;   // days
  select?: string[]; // schema key names
  limit?: number;
  offset?: number;
  orderBy?: { col: string; dir?: 'ASC' | 'DESC' };
}

export interface Stats {
  min: number | null;
  max: number | null;
  p50: number | null;
  p90: number | null;
  p95: number | null;
}

export interface WriteState {
  tableDef: TableDef;
  filters: Record<string, unknown>;
}

export interface UpdateState {
  tableDef: TableDef;
  data: Record<string, unknown>;
  filters: Record<string, unknown>;
}

export interface Queryable {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Executor {
  find<T>(state: QueryState): Promise<T[]>;
  count(state: QueryState): Promise<number>;
  stats(state: QueryState, col: string): Promise<Stats>;
  insert<T extends Record<string, unknown>>(tableDef: TableDef, rows: T[]): Promise<void>;
  update(state: UpdateState): Promise<void>;
  deleteWhere(state: WriteState): Promise<void>;
}
