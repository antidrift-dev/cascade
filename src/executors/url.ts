import type { Executor, QueryState, WriteState, UpdateState, Stats } from '../executor.js';
import type { TableDef } from '../schema.js';

export class UrlExecutor implements Executor {
  constructor(
    private readonly base: string,
    private readonly headers?: Record<string, string>,
  ) {}

  async find<T>(state: QueryState): Promise<T[]> {
    const res = await fetch(buildUrl(this.base, state), { headers: this.headers });
    if (!res.ok) throw new Error(`CDN ${res.status}: ${state.tableDef.path}`);
    return res.json() as Promise<T[]>;
  }

  async count(state: QueryState): Promise<number> {
    const res = await fetch(buildUrl(this.base, state, { agg: 'count' }), { headers: this.headers });
    if (!res.ok) throw new Error(`CDN ${res.status}: ${state.tableDef.path}`);
    const data = await res.json() as { total: number };
    return data.total;
  }

  async stats(state: QueryState, col: string): Promise<Stats> {
    const res = await fetch(buildUrl(this.base, state, { agg: 'stats', col }), { headers: this.headers });
    if (!res.ok) throw new Error(`CDN ${res.status}: ${state.tableDef.path}`);
    return res.json() as Promise<Stats>;
  }

  async insert<T extends Record<string, unknown>>(_tableDef: TableDef, _rows: T[]): Promise<void> {
    throw new Error('insert() not supported on UrlExecutor');
  }

  async update(_state: UpdateState): Promise<void> {
    throw new Error('update() not supported on UrlExecutor');
  }

  async deleteWhere(_state: WriteState): Promise<void> {
    throw new Error('deleteWhere() not supported on UrlExecutor');
  }
}

function buildUrl(base: string, state: QueryState, extra?: Record<string, string>): string {
  const params: Record<string, string> = {};

  for (const [key, val] of Object.entries(state.filters)) {
    if (val !== undefined) params[key] = String(val);
  }

  if (state.since)          params['days']   = String(state.since);
  if (state.select?.length) params['cols']   = state.select.join(',');
  if (state.limit != null)  params['limit']  = String(state.limit);
  if (state.offset != null) params['offset'] = String(state.offset);
  if (extra) Object.assign(params, extra);

  return `${base}/${state.tableDef.path}?${new URLSearchParams(params)}`;
}
