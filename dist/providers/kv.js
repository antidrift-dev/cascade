export class KvProvider {
    kv;
    name = 'kv';
    constructor(kv) {
        this.kv = kv;
    }
    async get(key) {
        const entry = await this.kv.get(key, 'json');
        if (!entry)
            return null;
        return entry;
    }
    async put(key, entry, ttl = 300) {
        await this.kv.put(key, JSON.stringify(entry), { expirationTtl: ttl });
    }
}
