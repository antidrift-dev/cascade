// D1 REST provider — key is the full query URL, data is the query result
// This is a write-through provider: get() is a no-op (D1 is the source of truth),
// put() is also a no-op (callers write to D1 directly via the engine).
// The D1 provider is used as a fetcher, not a cache layer.
export class D1Provider {
    accountId;
    databaseId;
    token;
    name = 'd1';
    constructor(accountId, databaseId, token) {
        this.accountId = accountId;
        this.databaseId = databaseId;
        this.token = token;
    }
    async get(_key) {
        return null; // always miss — D1 is queried via query() not get/put
    }
    async put(_key, _entry) {
        // no-op
    }
    async query(sql, params = []) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, params }),
        });
        if (!res.ok)
            throw new Error(`D1 HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        if (!data.success)
            throw new Error(`D1 error: ${data.errors.map(e => e.message).join(', ')}`);
        return data.result[0]?.results ?? [];
    }
}
