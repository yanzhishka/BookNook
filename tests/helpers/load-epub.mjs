import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const window = new JSDOM('').window;
export function loadEpub() {
  const cache = new Map();
  const load = name => {
    if (cache.has(name)) return cache.get(name);
    const source = ts.transpileModule(readFileSync(new URL(`../../services/epub/${name}.ts`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const exports = {};
    cache.set(name, exports);
    vm.runInNewContext(source, { exports, DOMParser: window.DOMParser, XMLSerializer: window.XMLSerializer, TextDecoder, URL,
      require: id => id.startsWith('./') ? load(id.slice(2)) : require(id),
    }, { filename: `services/epub/${name}.ts` });
    return exports;
  };
  return { ...load('document'), ...load('import'), ...load('web') };
}
