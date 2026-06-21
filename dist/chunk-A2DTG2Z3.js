// src/providers/d1.ts
var D1Provider = class {
  constructor(accountId, databaseId, token) {
    this.accountId = accountId;
    this.databaseId = databaseId;
    this.token = token;
  }
  accountId;
  databaseId;
  token;
  name = "d1";
  async get(_key) {
    return null;
  }
  async put(_key, _entry) {
  }
  async query(sql, params = []) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params })
    });
    if (!res.ok) throw new Error(`D1 HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (!data.success) throw new Error(`D1 error: ${data.errors.map((e) => e.message).join(", ")}`);
    return data.result[0]?.results ?? [];
  }
};

export {
  D1Provider
};
