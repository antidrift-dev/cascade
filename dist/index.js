import {
  Cascade
} from "./chunk-EXR3DXJS.js";
import {
  CfCacheProvider
} from "./chunk-FEKNJ5XB.js";
import {
  D1Provider
} from "./chunk-A2DTG2Z3.js";
import {
  KvProvider
} from "./chunk-2VJLCJ7U.js";
import {
  IndexedDbProvider
} from "./chunk-D2DFNKMN.js";

// src/schema.ts
function defineSchema(schema) {
  return schema;
}

// src/query.ts
var QueryChain = class {
  constructor(tableDef, executor) {
    this.tableDef = tableDef;
    this.executor = executor;
  }
  tableDef;
  executor;
  _filters = {};
  _since;
  _select;
  _limit;
  _offset;
  _orderBy;
  where(filters) {
    Object.assign(this._filters, filters);
    return this;
  }
  since(days) {
    this._since = days;
    return this;
  }
  select(cols) {
    this._select = cols;
    return this;
  }
  limit(n) {
    this._limit = n;
    return this;
  }
  offset(n) {
    this._offset = n;
    return this;
  }
  orderBy(col, dir = "ASC") {
    this._orderBy = { col, dir };
    return this;
  }
  count() {
    return this.executor.count(this.state());
  }
  fetch() {
    return this.executor.find(this.state());
  }
  stats(col) {
    return this.executor.stats(this.state(), col);
  }
  insert(rows) {
    return this.executor.insert(this.tableDef, rows);
  }
  update(data) {
    return this.executor.update({ tableDef: this.tableDef, data, filters: this._filters });
  }
  deleteWhere(filters) {
    return this.executor.deleteWhere({ tableDef: this.tableDef, filters });
  }
  state() {
    return {
      tableDef: this.tableDef,
      filters: this._filters,
      since: this._since,
      select: this._select,
      limit: this._limit,
      offset: this._offset,
      orderBy: this._orderBy
    };
  }
};

// src/db.ts
function createDb(schema, executor) {
  const db = {};
  for (const key of Object.keys(schema)) {
    Object.defineProperty(db, key, {
      get: () => new QueryChain(schema[key], executor),
      enumerable: true
    });
  }
  return db;
}

// src/executors/sql.ts
var INSERT_BATCH = 50;
var SqlExecutor = class {
  constructor(d1) {
    this.d1 = d1;
  }
  d1;
  async find(state) {
    const { sql, params } = buildSelect(state);
    return this.d1.query(sql, params);
  }
  async count(state) {
    const { sql, params } = buildCount(state);
    const rows = await this.d1.query(sql, params);
    return rows[0]?.total ?? 0;
  }
  async insert(tableDef, rows) {
    if (rows.length === 0) return;
    const { table, columns } = tableDef;
    const schemaKeys = Object.keys(columns);
    const sqlCols = schemaKeys.map((k) => columns[k].col);
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const chunk = rows.slice(i, i + INSERT_BATCH);
      const placeholders = chunk.map(() => `(${sqlCols.map(() => "?").join(",")})`).join(",");
      const params = [];
      for (const row of chunk) {
        for (const k of schemaKeys) params.push(row[k] ?? null);
      }
      await this.d1.query(
        `INSERT OR REPLACE INTO ${table} (${sqlCols.join(",")}) VALUES ${placeholders}`,
        params
      );
    }
  }
  async update(state) {
    const { table, columns } = state.tableDef;
    const setClauses = [];
    const params = [];
    for (const [key, val] of Object.entries(state.data)) {
      const col = columns[key]?.col;
      if (!col || val === void 0) continue;
      setClauses.push(`${col} = ?`);
      params.push(val);
    }
    if (setClauses.length === 0) return;
    const conditions = [];
    for (const [key, val] of Object.entries(state.filters)) {
      const col = columns[key]?.col;
      if (!col || val === void 0) continue;
      conditions.push(`${col} = ?`);
      params.push(val);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    await this.d1.query(`UPDATE ${table} SET ${setClauses.join(", ")} ${where}`, params);
  }
  async deleteWhere(state) {
    const { table, columns } = state.tableDef;
    const conditions = [];
    const params = [];
    for (const [key, val] of Object.entries(state.filters)) {
      const col = columns[key]?.col;
      if (!col || val === void 0) continue;
      conditions.push(`${col} = ?`);
      params.push(val);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    await this.d1.query(`DELETE FROM ${table} ${where}`, params);
  }
  async stats(state, col) {
    const sqlCol = state.tableDef.columns[col]?.col;
    if (!sqlCol) throw new Error(`Unknown column: ${col}`);
    const { sql, params } = buildStats(state, sqlCol);
    const rows = await this.d1.query(sql, params);
    return rows[0] ?? { min: null, max: null, p50: null, p90: null, p95: null };
  }
};
function buildWhere(state) {
  const { tableDef, filters, since } = state;
  const { columns } = tableDef;
  const conditions = [];
  const params = [];
  for (const [key, val] of Object.entries(filters)) {
    const sqlCol = columns[key]?.col;
    if (!sqlCol || val === void 0) continue;
    if (val === null) {
      conditions.push(`${sqlCol} IS NULL`);
    } else {
      conditions.push(`${sqlCol} = ?`);
      params.push(val);
    }
  }
  if (since) {
    conditions.push("crawled_at >= ?");
    params.push(new Date(Date.now() - since * 864e5).toISOString());
  }
  return { conditions, params };
}
function buildSelect(state) {
  const { tableDef, select, limit, offset, orderBy } = state;
  const { table, columns } = tableDef;
  const cols = select ? select.filter((k) => !!columns[k]).map((k) => `${columns[k].col} AS ${k}`) : Object.entries(columns).map(([k, def]) => def.col === k ? def.col : `${def.col} AS ${k}`);
  const { conditions, params } = buildWhere(state);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const order = orderBy ? `ORDER BY ${columns[orderBy.col]?.col ?? orderBy.col} ${orderBy.dir ?? "ASC"}` : "";
  const pagination = limit != null ? `LIMIT ${limit}${offset != null ? ` OFFSET ${offset}` : ""}` : "";
  return { sql: `SELECT ${cols.join(", ")} FROM ${table} ${where} ${order} ${pagination}`.trimEnd(), params };
}
function buildCount(state) {
  const { tableDef } = state;
  const { conditions, params } = buildWhere(state);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql: `SELECT COUNT(*) AS total FROM ${tableDef.table} ${where}`.trimEnd(), params };
}
function buildStats(state, sqlCol) {
  const { tableDef, filters, since } = state;
  const { table, columns } = tableDef;
  const conditions = [`${sqlCol} IS NOT NULL`];
  const params = [];
  for (const [key, val] of Object.entries(filters)) {
    const col = columns[key]?.col;
    if (!col || val === void 0) continue;
    conditions.push(`${col} = ?`);
    params.push(val);
  }
  if (since) {
    conditions.push("crawled_at >= ?");
    params.push(new Date(Date.now() - since * 864e5).toISOString());
  }
  const sql = `
    WITH ordered AS (
      SELECT ${sqlCol},
        ROW_NUMBER() OVER (ORDER BY ${sqlCol}) AS rn,
        COUNT(*) OVER () AS total
      FROM ${table} WHERE ${conditions.join(" AND ")}
    )
    SELECT
      MIN(${sqlCol}) AS min, MAX(${sqlCol}) AS max,
      MAX(CASE WHEN rn <= CAST(total * 0.5 + 0.5 AS INTEGER) THEN ${sqlCol} END) AS p50,
      MAX(CASE WHEN rn <= CAST(total * 0.9 + 0.5 AS INTEGER) THEN ${sqlCol} END) AS p90,
      MAX(CASE WHEN rn <= CAST(total * 0.95 + 0.5 AS INTEGER) THEN ${sqlCol} END) AS p95
    FROM ordered
  `;
  return { sql, params };
}

// src/executors/url.ts
var UrlExecutor = class {
  constructor(base, headers) {
    this.base = base;
    this.headers = headers;
  }
  base;
  headers;
  async find(state) {
    const res = await fetch(buildUrl(this.base, state), { headers: this.headers });
    if (!res.ok) throw new Error(`CDN ${res.status}: ${state.tableDef.path}`);
    return res.json();
  }
  async count(state) {
    const res = await fetch(buildUrl(this.base, state, { agg: "count" }), { headers: this.headers });
    if (!res.ok) throw new Error(`CDN ${res.status}: ${state.tableDef.path}`);
    const data = await res.json();
    return data.total;
  }
  async stats(state, col) {
    const res = await fetch(buildUrl(this.base, state, { agg: "stats", col }), { headers: this.headers });
    if (!res.ok) throw new Error(`CDN ${res.status}: ${state.tableDef.path}`);
    return res.json();
  }
  async insert(_tableDef, _rows) {
    throw new Error("insert() not supported on UrlExecutor");
  }
  async update(_state) {
    throw new Error("update() not supported on UrlExecutor");
  }
  async deleteWhere(_state) {
    throw new Error("deleteWhere() not supported on UrlExecutor");
  }
};
function buildUrl(base, state, extra) {
  const params = {};
  for (const [key, val] of Object.entries(state.filters)) {
    if (val !== void 0) params[key] = String(val);
  }
  if (state.since) params["days"] = String(state.since);
  if (state.select?.length) params["cols"] = state.select.join(",");
  if (state.limit != null) params["limit"] = String(state.limit);
  if (state.offset != null) params["offset"] = String(state.offset);
  if (extra) Object.assign(params, extra);
  return `${base}/${state.tableDef.path}?${new URLSearchParams(params)}`;
}
export {
  Cascade,
  CfCacheProvider,
  D1Provider,
  IndexedDbProvider,
  KvProvider,
  QueryChain,
  SqlExecutor,
  UrlExecutor,
  createDb,
  defineSchema
};
