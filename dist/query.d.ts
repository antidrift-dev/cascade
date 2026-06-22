import type { Executor, Stats } from './executor.js';
import type { TableDef } from './schema.js';
export declare class QueryChain<TRow extends Record<string, unknown>> {
    private readonly tableDef;
    private readonly executor;
    private _filters;
    private _since?;
    private _select?;
    private _limit?;
    private _offset?;
    private _orderBy?;
    constructor(tableDef: TableDef, executor: Executor);
    where(filters: Partial<TRow>): this;
    since(days: number): this;
    select(cols: (keyof TRow & string)[]): this;
    limit(n: number): this;
    offset(n: number): this;
    orderBy(col: keyof TRow & string, dir?: 'ASC' | 'DESC'): this;
    count(): Promise<number>;
    fetch(): Promise<TRow[]>;
    stats(col: keyof TRow & string): Promise<Stats>;
    insert(rows: TRow[]): Promise<void>;
    update(data: Partial<TRow>): Promise<void>;
    deleteWhere(filters: Partial<TRow>): Promise<void>;
    private state;
}
