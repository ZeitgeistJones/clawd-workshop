import { describeEvent, repoUrl } from './activity.js';

export function safeWebsite(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; }
  catch { return null; }
}

export function buildBrief(repo, metadata = {}, events = [], replay = false) {
  const evidence = events.filter(e => e.repo?.name === repo);
  const latest = evidence[0];
  return {
    name: repo?.split('/').slice(1).join('/') || 'The next little idea',
    description: metadata.description?.trim() || 'This repository has no public description yet. Open the source to explore what it does.',
    language: metadata.language || 'Language not listed',
    license: metadata.license?.spdx_id && metadata.license.spdx_id !== 'NOASSERTION' ? metadata.license.spdx_id : null,
    topics: Array.isArray(metadata.topics) ? metadata.topics.filter(t => typeof t === 'string').slice(0, 5) : [],
    website: safeWebsite(metadata.homepage), source: repoUrl(repo),
    update: latest ? describeEvent(latest) : null,
    updates: evidence.length, release: evidence.find(e => e.type === 'ReleaseEvent' && e.payload?.action === 'published'),
    context: replay ? 'Repository description is current; changes below come from this replay chapter.' : 'Repository description and linked commits from GitHub.',
  };
}
