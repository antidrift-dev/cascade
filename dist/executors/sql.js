const INSERT_BATCH = 10;
export class SqlExecutor {
    d1;
    constructor(d1) {
        this.d1 = d1;
    }
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
        if (rows.length === 0)
            return;
        const { table, columns } = tableDef;
        const schemaKeys = Object.keys(columns);
        const sqlCols = schemaKeys.map(k => columns[k].col);
        for (let i = 0; i < rows.length; i += INSERT_BATCH) {
            const chunk = rows.slice(i, i + INSERT_BATCH);
            const placeholders = chunk.map(() => `(${sqlCols.map(() => '?').join(',')})`).join(',');
            const params = [];
            for (const row of chunk) {
                for (const k of schemaKeys)
                    params.push(row[k] ?? null);
            }
            await this.d1.query(`INSERT OR REPLACE INTO ${table} (${sqlCols.join(',')}) VALUES ${placeholders}`, params);
        }
    }
    async update(state) {
        const { table, columns } = state.tableDef;
        const setClauses = [];
        const params = [];
        for (const [key, val] of Object.entries(state.data)) {
            const col = columns[key]?.col;
            if (!col || val === undefined)
                continue;
            setClauses.push(`${col} = ?`);
            params.push(val);
        }
        if (setClauses.length === 0)
            return;
        const conditions = [];
        for (const [key, val] of Object.entries(state.filters)) {
            const col = columns[key]?.col;
            if (!col || val === undefined)
                continue;
            conditions.push(`${col} = ?`);
            params.push(val);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        await this.d1.query(`UPDATE ${table} SET ${setClauses.join(', ')} ${where}`, params);
    }
    async deleteWhere(state) {
        const { table, columns } = state.tableDef;
        const conditions = [];
        const params = [];
        for (const [key, val] of Object.entries(state.filters)) {
            const col = columns[key]?.col;
            if (!col || val === undefined)
                continue;
            conditions.push(`${col} = ?`);
            params.push(val);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        await this.d1.query(`DELETE FROM ${table} ${where}`, params);
    }
    async stats(state, col) {
        const sqlCol = state.tableDef.columns[col]?.col;
        if (!sqlCol)
            throw new Error(`Unknown column: ${col}`);
        const { sql, params } = buildStats(state, sqlCol);
        const rows = await this.d1.query(sql, params);
        return rows[0] ?? { min: null, max: null, p50: null, p90: null, p95: null };
    }
}
function buildWhere(state) {
    const { tableDef, filters, since } = state;
    const { columns } = tableDef;
    const conditions = [];
    const params = [];
    for (const [key, val] of Object.entries(filters)) {
        const sqlCol = columns[key]?.col;
        if (!sqlCol || val === undefined)
            continue;
        if (val === null) {
            conditions.push(`${sqlCol} IS NULL`);
        }
        else {
            conditions.push(`${sqlCol} = ?`);
            params.push(val);
        }
    }
    if (since) {
        conditions.push('crawled_at >= ?');
        params.push(new Date(Date.now() - since * 86_400_000).toISOString());
    }
    return { conditions, params };
}
function buildSelect(state) {
    const { tableDef, select, limit, offset, orderBy } = state;
    const { table, columns } = tableDef;
    const cols = select
        ? select.filter(k => !!columns[k]).map(k => `${columns[k].col} AS ${k}`)
        : Object.entries(columns).map(([k, def]) => def.col === k ? def.col : `${def.col} AS ${k}`);
    const { conditions, params } = buildWhere(state);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const order = orderBy
        ? `ORDER BY ${columns[orderBy.col]?.col ?? orderBy.col} ${orderBy.dir ?? 'ASC'}`
        : '';
    const pagination = limit != null ? `LIMIT ${limit}${offset != null ? ` OFFSET ${offset}` : ''}` : '';
    return { sql: `SELECT ${cols.join(', ')} FROM ${table} ${where} ${order} ${pagination}`.trimEnd(), params };
}
function buildCount(state) {
    const { tableDef } = state;
    const { conditions, params } = buildWhere(state);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { sql: `SELECT COUNT(*) AS total FROM ${tableDef.table} ${where}`.trimEnd(), params };
}
function buildStats(state, sqlCol) {
    const { tableDef, filters, since } = state;
    const { table, columns } = tableDef;
    const conditions = [`${sqlCol} IS NOT NULL`];
    const params = [];
    for (const [key, val] of Object.entries(filters)) {
        const col = columns[key]?.col;
        if (!col || val === undefined)
            continue;
        conditions.push(`${col} = ?`);
        params.push(val);
    }
    if (since) {
        conditions.push('crawled_at >= ?');
        params.push(new Date(Date.now() - since * 86_400_000).toISOString());
    }
    const sql = `
    WITH ordered AS (
      SELECT ${sqlCol},
        ROW_NUMBER() OVER (ORDER BY ${sqlCol}) AS rn,
        COUNT(*) OVER () AS total
      FROM ${table} WHERE ${conditions.join(' AND ')}
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
