import type { Executor, QueryState, WriteState, UpdateState, Stats, Queryable } from '../executor.js';
import type { TableDef } from '../schema.js';
export declare class SqlExecutor implements Executor {
    private readonly d1;
    constructor(d1: Queryable);
    find<T>(state: QueryState): Promise<T[]>;
    count(state: QueryState): Promise<number>;
    insert<T extends Record<string, unknown>>(tableDef: TableDef, rows: T[]): Promise<void>;
    update(state: UpdateState): Promise<void>;
    deleteWhere(state: WriteState): Promise<void>;
    stats(state: QueryState, col: string): Promise<Stats>;
}
