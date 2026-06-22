export class IndexedDbProvider {
    table;
    name = 'indexeddb';
    constructor(table) {
        this.table = table;
    }
    async get(key) {
        const entry = await this.table.get(key);
        if (!entry)
            return null;
        return { data: entry.data, etag: entry.etag, cachedAt: entry.cachedAt };
    }
    async put(key, entry) {
        await this.table.put({ key, ...entry });
    }
}
