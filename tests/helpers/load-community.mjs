import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

export function loadCommunity(supabase) {
  const source = ts.transpileModule(readFileSync(new URL('../../services/community.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {}, DOMException, require(name) {
    if (name === './supabase') return { supabase };
    throw new Error(`Unexpected runtime import: ${name}`);
  } };
  vm.runInNewContext(source, context, { filename: 'services/community.ts' });
  return context.exports;
}
