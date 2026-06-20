import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index:                  'src/index.ts',
    'core/index':           'src/core/index.ts',
    'providers/cf-cache':   'src/providers/cf-cache.ts',
    'providers/d1':         'src/providers/d1.ts',
    'providers/kv':         'src/providers/kv.ts',
    'providers/indexeddb':  'src/providers/indexeddb.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
});
