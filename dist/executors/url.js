export class UrlExecutor {
    base;
    headers;
    constructor(base, headers) {
        this.base = base;
        this.headers = headers;
    }
    async find(state) {
        const res = await fetch(buildUrl(this.base, state), { headers: this.headers });
        if (!res.ok)
            throw new Error(`CDN ${res.status}: ${state.tableDef.path}`);
        return res.json();
    }
    async count(state) {
        const res = await fetch(buildUrl(this.base, state, { agg: 'count' }), { headers: this.headers });
        if (!res.ok)
            throw new Error(`CDN ${res.status}: ${state.tableDef.path}`);
        const data = await res.json();
        return data.total;
    }
    async stats(state, col) {
        const res = await fetch(buildUrl(this.base, state, { agg: 'stats', col }), { headers: this.headers });
        if (!res.ok)
            throw new Error(`CDN ${res.status}: ${state.tableDef.path}`);
        return res.json();
    }
    async insert(_tableDef, _rows) {
        throw new Error('insert() not supported on UrlExecutor');
    }
    async update(_state) {
        throw new Error('update() not supported on UrlExecutor');
    }
    async deleteWhere(_state) {
        throw new Error('deleteWhere() not supported on UrlExecutor');
    }
}
function buildUrl(base, state, extra) {
    const params = {};
    for (const [key, val] of Object.entries(state.filters)) {
        if (val !== undefined)
            params[key] = String(val);
    }
    if (state.since)
        params['days'] = String(state.since);
    if (state.select?.length)
        params['cols'] = state.select.join(',');
    if (state.limit != null)
        params['limit'] = String(state.limit);
    if (state.offset != null)
        params['offset'] = String(state.offset);
    if (extra)
        Object.assign(params, extra);
    return `${base}/${state.tableDef.path}?${new URLSearchParams(params)}`;
}
