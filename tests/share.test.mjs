import test from 'node:test';
import assert from 'node:assert/strict';
import { siteBase, shareMetadata, injectMetadata } from '../scripts/share-metadata.mjs';

test('share URLs use the stable Vercel production domain and respect custom base paths', () => {
  assert.equal(siteBase({ VERCEL_PROJECT_PRODUCTION_URL: 'workshop.vercel.app', VERCEL_URL: 'temporary.vercel.app' }), 'https://workshop.vercel.app/');
  const base = siteBase({ SITE_URL: 'https://example.com/workshop', VERCEL_PROJECT_PRODUCTION_URL: 'other.vercel.app' });
  assert.match(shareMetadata(base, true), /https:\/\/example.com\/workshop\/public\/share\/player.html/);
  assert.match(shareMetadata(base), /https:\/\/example.com\/workshop\/public\/share-preview-v2.png/);
});
test('invalid sharing URLs fail clearly instead of producing broken or unsafe metadata', () => {
  for (const value of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/?q=1', 'https://example.com/#fragment', 'not a URL']) assert.throws(() => siteBase({ SITE_URL: value }));
  assert.equal(siteBase({}), null);
});
test('video metadata is opt-in and falls back to an image without a public URL', () => {
  assert.match(shareMetadata(null, true), /summary_large_image/);
  assert.doesNotMatch(shareMetadata(null, true), /twitter:player/);
  assert.doesNotMatch(shareMetadata('https://example.com/'), /og:video|twitter:player/);
  const result = injectMetadata('<head><!-- SHARE-METADATA:START -->old<!-- SHARE-METADATA:END --></head><body>unchanged</body>', 'https://example.com/', true);
  assert.match(result, /name="twitter:card" content="player"/);
  assert.match(result, /og:video:type" content="video\/mp4"/);
  assert.match(result, /<body>unchanged<\/body>/);
  assert.doesNotMatch(result, />old</);
});
