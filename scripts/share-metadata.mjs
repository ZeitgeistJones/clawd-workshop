const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function siteBase(env = process.env) {
  const configured = env.SITE_URL?.trim();
  const host = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!configured && !host) return null;
  const url = new URL(configured || `https://${host}`);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('SITE_URL must be a public HTTPS URL without credentials, query, or fragment.');
  }
  url.pathname = url.pathname.replace(/\/+$/, '') + '/';
  return url.href;
}

export function shareMetadata(base, video = false) {
  const image = base ? new URL('public/share-preview.png', base).href : (video ? '../share-preview.png' : './public/share-preview.png');
  const description = 'little guy, big ideas.';
  const tags = [
    ['property', 'og:type', video ? 'video.other' : 'website'],
    ['property', 'og:site_name', 'Clawd Workshop'],
    ['property', 'og:title', 'What is Clawdbotatg Building?'],
    ['property', 'og:description', description],
    ['property', 'og:image', image],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', 'Clawd working at a bench in his little workshop.'],
    ['name', 'twitter:card', video && base ? 'player' : 'summary_large_image'],
    ['name', 'twitter:title', 'What is Clawdbotatg Building?'],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', image],
    ['name', 'twitter:image:alt', 'Clawd working at a bench in his little workshop.'],
  ];
  if (base) tags.push(['property', 'og:url', new URL(video ? 'public/share/index.html' : './', base).href]);
  if (video && base) {
    const clip = new URL('public/workshop-preview.mp4', base).href;
    tags.push(['property', 'og:video', clip], ['property', 'og:video:secure_url', clip], ['property', 'og:video:type', 'video/mp4'], ['property', 'og:video:width', '640'], ['property', 'og:video:height', '360'], ['name', 'twitter:player', new URL('public/share/player.html', base).href], ['name', 'twitter:player:width', '640'], ['name', 'twitter:player:height', '360'], ['name', 'twitter:player:stream', clip], ['name', 'twitter:player:stream:content_type', 'video/mp4']);
  }
  const canonical = base ? `\n  <link rel="canonical" href="${escape(new URL(video ? 'public/share/index.html' : './', base).href)}">` : '';
  return tags.map(([attr, key, value]) => `  <meta ${attr}="${key}" content="${escape(value)}">`).join('\n') + canonical;
}

export function injectMetadata(html, base, video = false) {
  return html.replace(/<!-- SHARE-METADATA:START -->[\s\S]*?<!-- SHARE-METADATA:END -->/, `<!-- SHARE-METADATA:START -->\n${shareMetadata(base, video)}\n  <!-- SHARE-METADATA:END -->`);
}
