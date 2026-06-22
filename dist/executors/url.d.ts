import type { Executor, QueryState, WriteState, UpdateState, Stats } from '../executor.js';
import type { TableDef } from '../schema.js';
export declare class UrlExecutor implements Executor {
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
