export { C as CacheEntry, F as Fetcher, P as Provider, Q as QueryDef, R as ResolveOptions } from './types-BWzYgGdF.js';
export { Cascade } from './core/index.js';
export { CfCacheProvider } from './providers/cf-cache.js';
export { KvProvider } from './providers/kv.js';
export { D1Provider } from './providers/d1.js';
export { IndexedDbProvider } from './providers/indexeddb.js';

type ColType = 'text' | 'number' | 'real';
interface ColDef {
    col: string;
    type: ColType;
}
interface TableDef {
    table: string;
    path: string;
    columns: Record<string, ColDef>;
}
type Schema = Record<string, TableDef>;
declare function defineSchema<T extends Schema>(schema: T): T;
type ColValue<T extends ColType> = T extends 'text' ? string : number;
type RowType<T extends Record<string, ColDef>> = {
    [K in keyof T]?: ColValue<T[K]['type']>;
};

interface QueryState {
    tableDef: TableDef;
    filters: Record<string, unknown>;
    since?: number;
    select?: string[];
    limit?: number;
    offset?: number;
    orderBy?: {
        col: string;
        dir?: 'ASC' | 'DESC';
    };
}
interface Stats {
    min: number | null;
    max: number | null;
    p50: number | null;
    p90: number | null;
    p95: number | null;
}
interface WriteState {
    tableDef: TableDef;
    filters: Record<string, unknown>;
}
interface UpdateState {
    tableDef: TableDef;
    data: Record<string, unknown>;
    filters: Record<string, unknown>;
}
interface Queryable {
    query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
interface Executor {
    find<T>(state: QueryState): Promise<T[]>;
    count(state: QueryState): Promise<number>;
    stats(state: QueryState, col: string): Promise<Stats>;
    insert<T extends Record<string, unknown>>(tableDef: TableDef, rows: T[]): Promise<void>;
    update(state: UpdateState): Promise<void>;
    deleteWhere(state: WriteState): Promise<void>;
}

declare class QueryChain<TRow extends Record<string, unknown>> {
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

type DbFromSchema<T extends Schema> = {
    readonly [K in keyof T]: QueryChain<RowType<T[K]['columns']>>;
};
declare function createDb<T extends Schema>(schema: T, executor: Executor): DbFromSchema<T>;

declare class SqlExecutor implements Executor {
    private readonly d1;
    constructor(d1: Queryable);
    find<T>(state: QueryState): Promise<T[]>;
    count(state: QueryState): Promise<number>;
    insert<T extends Record<string, unknown>>(tableDef: TableDef, rows: T[]): Promise<void>;
    update(state: UpdateState): Promise<void>;
    deleteWhere(state: WriteState): Promise<void>;
    stats(state: QueryState, col: string): Promise<Stats>;
}

declare class UrlExecutor implements Executor {
    private readonly base;
    private readonly headers?;
    constructor(base: string, headers?: Record<string, string> | undefined);
    find<T>(state: QueryState): Promise<T[]>;
    count(state: QueryState): Promise<number>;
    stats(state: QueryState, col: string): Promise<Stats>;
    insert<T extends Record<string, unknown>>(_tableDef: TableDef, _rows: T[]): Promise<void>;
    update(_state: UpdateState): Promise<void>;
    deleteWhere(_state: WriteState): Promise<void>;
}

export { type ColDef, type ColType, type Executor, QueryChain, type QueryState, type Queryable, type RowType, type Schema, SqlExecutor, type Stats, type TableDef, type UpdateState, UrlExecutor, type WriteState, createDb, defineSchema };
