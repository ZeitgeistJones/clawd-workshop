import { mkdir, rm, cp, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { siteBase, injectMetadata } from './share-metadata.mjs';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const base = siteBase();
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of ['index.html', 'src', 'public']) await cp(new URL(item, root), new URL(item, dist), { recursive: true });
for (const [item, video] of [['index.html', false], ['public/share/index.html', true]]) {
  const target = new URL(item, dist);
  await writeFile(target, injectMetadata(await readFile(target, 'utf8'), base, video));
}
if (!base) console.warn('Share previews need a public URL: set SITE_URL before building, or build on Vercel with system environment variables enabled.');
await writeFile(new URL('.nojekyll', dist), '');
console.log(`Static site built at ${fileURLToPath(dist)}`);
