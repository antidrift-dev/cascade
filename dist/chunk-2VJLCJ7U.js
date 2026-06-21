// src/providers/kv.ts
var KvProvider = class {
  constructor(kv) {
    this.kv = kv;
  }
  kv;
  name = "kv";
  async get(key) {
    const entry = await this.kv.get(key, "json");
    if (!entry) return null;
    return entry;
  }
  async put(key, entry, ttl = 300) {
    await this.kv.put(key, JSON.stringify(entry), { expirationTtl: ttl });
  }
};

export {
  KvProvider
};
