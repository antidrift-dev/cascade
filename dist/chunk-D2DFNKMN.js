// src/providers/indexeddb.ts
var IndexedDbProvider = class {
  constructor(table) {
    this.table = table;
  }
  table;
  name = "indexeddb";
  async get(key) {
    const entry = await this.table.get(key);
    if (!entry) return null;
    return { data: entry.data, etag: entry.etag, cachedAt: entry.cachedAt };
  }
  async put(key, entry) {
    await this.table.put({ key, ...entry });
  }
};

export {
  IndexedDbProvider
};
