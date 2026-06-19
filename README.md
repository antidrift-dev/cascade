# cascade

Provider-chained isomorphic data layer for Cloudflare Workers + browser.

Define a schema once. Query it the same way whether you're in a CF Worker, on the browser, or in a test — the provider chain handles where data comes from.

```ts
import { defineSchema, createDb, Cascade } from '@antidrift/cascade';
import { IndexedDbProvider } from '@antidrift/cascade/providers/indexeddb';
import { UrlExecutor } from '@antidrift/cascade/executors/url';

const schema = defineSchema({
  pagespeed: {
    table: 'pagespeed_metrics',
    path: 'trend/pagespeed',
    columns: {
      crawledAt:      { col: 'crawled_at',      type: 'text'   },
      connectionType: { col: 'connection_type',  type: 'text'   },
      lcpMs:          { col: 'lcp_ms',           type: 'number' },
    },
  },
});

const executor = new UrlExecutor('https://cdn.example.com/customer/domain');
const db = createDb(schema, executor);

// .where().orderBy().limit().fetch()
const rows = await db.pagespeed
  .where({ connectionType: '4g_fast' })
  .orderBy('crawledAt', 'desc')
  .limit(14)
  .fetch();
```

## Providers

| Provider | Where it runs | What it does |
|---|---|---|
| `IndexedDbProvider` | Browser | Persists to IndexedDB via Dexie, respects ETag for cache invalidation |
| `CfCacheProvider` | CF Worker | Uses `caches.default` for Worker-level edge caching |
| `D1Provider` | CF Worker | Queries D1 via Cloudflare REST API |
| `KvProvider` | CF Worker | Reads/writes CF KV |

Stack providers to get layered caching:

```ts
const cascade = new Cascade([
  new IndexedDbProvider('my-app'),  // check browser cache first
  // fetcher is the fallback
]);
```

## Executors

Executors translate a `QueryChain` into an actual request.

- `UrlExecutor` — fetches from a URL (browser or Worker)
- `SqlExecutor` — executes against a D1 database binding

## Schema types

```ts
import type { RowType } from '@antidrift/cascade';

// Derive a TypeScript type from column definitions
type PagespeedRow = Required<RowType<typeof schema.pagespeed.columns>>;
// → { crawledAt: string; connectionType: string; lcpMs: number }
```

## Install

```sh
npm install @antidrift/cascade
```

Dexie is an optional peer dependency — only needed if you use `IndexedDbProvider`.

```sh
npm install dexie
```
