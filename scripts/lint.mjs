import { readdirSync, readFileSync } from 'node:fs';
import { transform } from 'esbuild';
// Syntax and merge-marker checks; no unconfigured style rules or new dependencies.
let count = 0;
for (const folder of ['src', 'scripts', 'test']) for (const file of readdirSync(folder)) {
  if (!/\.(?:js|jsx|mjs)$/.test(file)) continue;
  const path = `${folder}/${file}`;
  const source = readFileSync(path, 'utf8');
  if (/^(?:<{7}|={7}|>{7})/m.test(source)) throw new Error(`Unresolved merge marker in ${path}`);
  await transform(source, { loader: file.endsWith('jsx') ? 'jsx' : 'js', sourcefile: path, target: 'esnext' });
  count++;
}
console.log(`Syntax and merge-marker checks passed for ${count} source, script and test files.`);
