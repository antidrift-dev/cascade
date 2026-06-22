import { QueryChain } from './query.js';
export function createDb(schema, executor) {
    const db = {};
    for (const key of Object.keys(schema)) {
        Object.defineProperty(db, key, {
            get: () => new QueryChain(schema[key], executor),
            enumerable: true,
        });
    }
    return db;
}
