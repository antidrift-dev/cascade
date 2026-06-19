import type { Executor, QueryState, WriteState, UpdateState, Stats } from './executor.js';
import type { TableDef } from './schema.js';

export class QueryChain<TRow extends Record<string, unknown>> {
  private _filters: Record<string, unknown> = {};
  private _since?: number;
  private _select?: string[];
  private _limit?: number;
  private _offset?: number;
  private _orderBy?: { col: string; dir?: 'ASC' | 'DESC' };

  constructor(
    private readonly tableDef: TableDef,
    private readonly executor: Executor,
  ) {}

  where(filters: Partial<TRow>): this {
    Object.assign(this._filters, filters);
    return this;
  }

  since(days: number): this {
    this._since = days;
    return this;
  }

  select(cols: (keyof TRow & string)[]): this {
    this._select = cols;
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  offset(n: number): this {
    this._offset = n;
    return this;
  }

  orderBy(col: keyof TRow & string, dir: 'ASC' | 'DESC' = 'ASC'): this {
    this._orderBy = { col, dir };
    return this;
  }

  count(): Promise<number> {
    return this.executor.count(this.state());
  }

  fetch(): Promise<TRow[]> {
    return this.executor.find<TRow>(this.state());
  }

  stats(col: keyof TRow & string): Promise<Stats> {
    return this.executor.stats(this.state(), col);
  }

  insert(rows: TRow[]): Promise<void> {
    return this.executor.insert(this.tableDef, rows);
  }

  update(data: Partial<TRow>): Promise<void> {
    return this.executor.update({ tableDef: this.tableDef, data: data as Record<string, unknown>, filters: this._filters });
  }

  deleteWhere(filters: Partial<TRow>): Promise<void> {
    return this.executor.deleteWhere({ tableDef: this.tableDef, filters: filters as Record<string, unknown> });
  }

  private state(): QueryState {
    return {
      tableDef: this.tableDef,
      filters: this._filters,
      since: this._since,
      select: this._select,
      limit: this._limit,
      offset: this._offset,
      orderBy: this._orderBy,
    };
  }
}
