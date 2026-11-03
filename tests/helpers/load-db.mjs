import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Exercise the application's actual service with either a fake client or the
// real authenticated client, without starting a browser or changing imports.
export function loadDb(supabase) {
  const cache = new Map();
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(source, {
      exports, console, crypto: globalThis.crypto, AbortController,
      require(name) {
        if (name === './supabase') return { supabase };
        if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => false } };
        if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.ts`));
        throw new Error(`Unexpected runtime import: ${name}`);
      },
    }, { filename });
    return exports;
  };
  return load(fileURLToPath(new URL('../../services/db.ts', import.meta.url))).db;
}
