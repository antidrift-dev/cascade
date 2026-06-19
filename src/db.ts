import type { Schema, TableDef, RowType } from './schema.js';
import type { Executor } from './executor.js';
import { QueryChain } from './query.js';

type DbFromSchema<T extends Schema> = {
  readonly [K in keyof T]: QueryChain<RowType<T[K]['columns']>>;
};

export function createDb<T extends Schema>(schema: T, executor: Executor): DbFromSchema<T> {
  const db = {} as DbFromSchema<T>;

  for (const key of Object.keys(schema) as (keyof T & string)[]) {
    Object.defineProperty(db, key, {
      get: () => new QueryChain(schema[key] as TableDef, executor),
      enumerable: true,
    });
  }

  return db;
}
