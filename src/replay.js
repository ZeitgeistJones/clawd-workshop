import { CONFIG } from './config.js';
import { normalizeEvents, describeEvent } from './activity.js';
export const DAY_MS = 24 * 60 * 60 * 1000;
const date = value => Date.parse(value);
export function mergeEvents(...groups) {
  const seen = new Map();
  for (const e of normalizeEvents(groups.flat())) {
    const key = e.id || `${e.type}:${e.repo.name}:${e.created_at}:${e.payload?.head || e.payload?.push_id || e.payload?.ref || e.payload?.action || ''}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()].sort((a, b) => date(b.created_at) - date(a.created_at));
}
function chapterState(events) {
  if (events.some(e => e.type === 'ReleaseEvent' && e.payload?.action === 'published')) return 'shipping';
  return events.some(e => ['PushEvent', 'PullRequestEvent'].includes(e.type)) ? 'building' : 'planning';
}
export function makeReplay(events, options = {}) {
  const end = options.end ?? Date.now(), start = end - DAY_MS;
  const ordered = mergeEvents(events).filter(e => date(e.created_at) >= start && date(e.created_at) <= end).reverse();
  const activity = [];
  for (const e of ordered) {
    const t = date(e.created_at), last = activity.at(-1);
    const release = e.type === 'ReleaseEvent' && e.payload?.action === 'published';
    // Preserve project switches and release moments, group adjacent work bursts.
    if (last && last.repo === e.repo.name && t - last.end <= 30 * 60000 && !release && last.state !== 'shipping') {
      last.events.push(e); last.end = t; last.state = chapterState(last.events);
    } else activity.push({ repo: e.repo.name, events: [e], start: t, end: t, state: chapterState([e]) });
  }
  const chapters = [];
  const gap = (from, to) => {
    if (to - from < 75 * 60000) return;
    const missing = options.partial && from < (options.coverageStart ?? to);
    chapters.push({ start: from, end: to, repo: null, events: [], state: missing ? 'unknown' : 'idle', title: missing ? 'Earlier activity unavailable' : 'No fetched signals in this stretch', quiet: true });
  };
  let cursor = start;
  for (const c of activity) { gap(cursor, c.start); chapters.push(c); cursor = c.end; }
  if (activity.length) gap(cursor, end);
  if (!activity.length) return { chapters: [], events: [], start, end, durationMs: 0, requestedDurationMs: options.durationMs ?? CONFIG.replayDurationMs, projectCount: 0 };
  const requestedDurationMs = options.durationMs ?? CONFIG.replayDurationMs;
  const minMs = CONFIG.minChapterMs;
  const caps = chapters.map(c => Math.max(minMs, c.quiet ? 10000 : 30000));
  const durationMs = Math.max(chapters.length * minMs, Math.min(requestedDurationMs, caps.reduce((a, b) => a + b, 0)));
  const weights = chapters.map(c => c.quiet ? .2 : 1 + Math.log2(c.events.length + 1) * .35);
  const durations = chapters.map(() => minMs);
  let extra = durationMs - chapters.length * minMs, active = chapters.map((_, i) => i);
  while (extra > .01 && active.length) {
    const totalWeight = active.reduce((sum, i) => sum + weights[i], 0);
    let used = 0;
    for (const i of active) { const add = Math.min(caps[i] - durations[i], extra * weights[i] / totalWeight); durations[i] += add; used += add; }
    extra -= used; active = active.filter(i => durations[i] < caps[i] - .01);
  }
  let offset = 0;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i]; c.offsetMs = offset; c.durationMs = durations[i];
    c.title ||= c.repo.split('/').slice(1).join('/');
    c.summary = c.quiet ? c.title : c.events.length === 1 ? describeEvent(c.events[0]).title : `${c.events.length} public updates · ${c.events.filter(e => e.type === 'PushEvent').length} pushes`;
    offset += c.durationMs;
  }
  return { chapters, events: ordered.reverse(), start, end, durationMs: offset, requestedDurationMs, projectCount: new Set(activity.map(c => c.repo)).size };
}
export function replayFrame(plan, elapsedMs) {
  if (!plan?.chapters.length) return null;
  const elapsed = Math.max(0, Math.min(elapsedMs, plan.durationMs));
  let index = plan.chapters.findIndex(c => elapsed < c.offsetMs + c.durationMs);
  if (index < 0) index = plan.chapters.length - 1;
  const chapter = plan.chapters[index], progress = Math.max(0, Math.min(1, (elapsed - chapter.offsetMs) / chapter.durationMs));
  // Each work chapter is a summary of its burst. Quiet stretches advance smoothly.
  const at = chapter.quiet ? chapter.start + (chapter.end - chapter.start) * progress : chapter.end;
  return { index, chapter, progress, at, ended: elapsed >= plan.durationMs };
}
export function formatDuration(ms) { const total = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; }
