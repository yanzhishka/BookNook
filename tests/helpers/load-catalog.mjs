import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);

export function loadCatalog(fetcher = globalThis.fetch) {
  const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const shared = { exports: {} };
  vm.runInNewContext(compile('../../shared/bookCatalog.ts'), shared);
  const context = { exports: {}, URL, URLSearchParams, TextEncoder, AbortSignal, fetch: fetcher,
    require: id => id.startsWith('npm:linkedom') ? require('linkedom') : shared.exports };
  vm.runInNewContext(compile('../../supabase/functions/book-proxy/catalog.ts'), context);
  return context.exports;
}
