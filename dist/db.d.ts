import type { Schema, RowType } from './schema.js';
import type { Executor } from './executor.js';
import { QueryChain } from './query.js';
type DbFromSchema<T extends Schema> = {
    readonly [K in keyof T]: QueryChain<RowType<T[K]['columns']>>;
};
export declare function createDb<T extends Schema>(schema: T, executor: Executor): DbFromSchema<T>;
export {};
