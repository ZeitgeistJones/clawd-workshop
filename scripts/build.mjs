import { mkdir, rm, cp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of ['index.html', 'src', 'public']) await cp(new URL(item, root), new URL(item, dist), { recursive: true });
await writeFile(new URL('.nojekyll', dist), '');
console.log(`Static site built at ${fileURLToPath(dist)}`);
