import { CONFIG } from './config.js';

const WEIGHTS = { PushEvent: 16, PullRequestEvent: 22, PullRequestReviewEvent: 8,
  CreateEvent: 10, IssuesEvent: 5, IssueCommentEvent: 3, ReleaseEvent: 35 };
const activeTypes = new Set(Object.keys(WEIGHTS));
const ms = value => Date.parse(value);
export const repoUrl = name => /^[-\w.]+\/[-\w.]+$/.test(name || '') ? `https://github.com/${name}` : 'https://github.com';
export function safeGithubUrl(value, fallback = 'https://github.com') {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'github.com' && !u.username && !u.password ? u.href : fallback; }
  catch { return fallback; }
}
export function normalizeEvents(input) {
  if (!Array.isArray(input)) throw new Error('Unexpected GitHub event response.');
  return input.filter(e => e && activeTypes.has(e.type) && Number.isFinite(ms(e.created_at)) &&
    /^[-\w.]+\/[-\w.]+$/.test(e.repo?.name || '')).sort((a, b) => ms(b.created_at) - ms(a.created_at));
}
export function describeEvent(event) {
  const p = event.payload || {};
  const repo = event.repo.name;
  let title = 'Repository activity', detail = '', url = repoUrl(repo), icon = '↗';
  switch (event.type) {
    case 'PushEvent': {
      const count = p.size ?? p.commits?.length;
      title = count ? `Pushed ${count} commit${count === 1 ? '' : 's'}` : 'Pushed code';
      detail = p.ref?.replace('refs/heads/', '') || 'Repository push'; icon = '⌘';
      if (typeof p.head === 'string' && /^[a-f0-9]{7,40}$/i.test(p.head)) url += `/commit/${p.head}`;
      break;
    }
    case 'PullRequestEvent':
      title = p.pull_request?.merged ? 'Merged a pull request' : `${p.action || 'Updated'} a pull request`;
      detail = p.pull_request?.title || ''; url = safeGithubUrl(p.pull_request?.html_url, url); icon = '⑂'; break;
    case 'PullRequestReviewEvent': title = 'Reviewed a pull request'; detail = p.pull_request?.title || ''; icon = '✓'; break;
    case 'CreateEvent': title = `Created a ${p.ref_type || 'repository'}`; detail = p.ref || ''; icon = '+'; break;
    case 'IssuesEvent': title = `${p.action || 'Updated'} an issue`; detail = p.issue?.title || ''; url = safeGithubUrl(p.issue?.html_url, url); icon = '◎'; break;
    case 'IssueCommentEvent': title = 'Joined the conversation'; detail = p.issue?.title || ''; url = safeGithubUrl(p.comment?.html_url, url); icon = '…'; break;
    case 'ReleaseEvent': title = p.action === 'published' ? 'Published a release' : 'Updated a release'; detail = p.release?.tag_name || ''; url = safeGithubUrl(p.release?.html_url, url); icon = '✦'; break;
  }
  return { title: title[0].toUpperCase() + title.slice(1), detail, repo, url, icon, time: event.created_at };
}
export function pulse(events, now = Date.now()) {
  const sum = events.reduce((total, e) => {
    const age = now - ms(e.created_at);
    return age >= 0 && age < 24 * 60 * 60 * 1000 ? total + (WEIGHTS[e.type] || 0) * 2 ** (-age / CONFIG.pulseHalfLifeMs) : total;
  }, 0);
  return Math.min(100, Math.round(100 * (1 - Math.exp(-sum / 60))));
}
export function pulseSeries(events, now = Date.now()) {
  return Array.from({ length: 61 }, (_, i) => pulse(events, now - (60 - i) * 60000));
}
/** Public events can lag hours behind GitHub's repo "Updated" / pushed_at. Prefer the newer honest signal. */
export function freshestSignal(events = [], repos = [], now = Date.now()) {
  const recent = events.find(e => ms(e.created_at) <= now) || null;
  const push = [...repos]
    .filter(r => r && /^[-\w.]+\/[-\w.]+$/.test(r.full_name || '') && Number.isFinite(ms(r.pushed_at)) && ms(r.pushed_at) <= now + 60_000)
    .sort((a, b) => ms(b.pushed_at) - ms(a.pushed_at))[0] || null;
  const eventAt = recent ? ms(recent.created_at) : -Infinity;
  const pushAt = push ? ms(push.pushed_at) : -Infinity;
  if (push && pushAt > eventAt + 30_000) {
    return { source: 'repo-push', repo: push.full_name, at: push.pushed_at, event: null };
  }
  if (recent) return { source: 'event', repo: recent.repo.name, at: recent.created_at, event: recent };
  if (push) return { source: 'repo-push', repo: push.full_name, at: push.pushed_at, event: null };
  return null;
}
export function deriveStatus(events, runs = [], now = Date.now(), unavailable = false, repos = []) {
  const signal = freshestSignal(events, repos, now);
  const recent = signal?.source === 'event' ? signal.event : events.find(e => ms(e.created_at) <= now) || null;
  const base = {
    state: 'idle',
    label: 'Workshop is quiet',
    reason: signal ? 'No recent public building signal.' : 'No public building signals in the fetched activity window.',
    repo: signal?.repo || null,
    lastActivity: signal?.at || null,
    signalSource: signal?.source || null,
  };
  if (unavailable) return { ...base, state: 'unknown', label: 'Waiting for a signal', reason: 'GitHub could not be checked. Any activity below is a saved snapshot.' };
  const running = runs.find(r => ['in_progress', 'queued', 'waiting', 'pending', 'requested'].includes(r.status));
  if (running) return { ...base, state: 'testing', label: 'Checks are running', repo: running.repo, reason: `${running.name || 'GitHub Actions'} is ${running.status.replaceAll('_', ' ')}. This may be a build or test workflow.`, evidenceUrl: safeGithubUrl(running.html_url) };
  if (!signal || now - ms(signal.at) > CONFIG.activeWindowMs) return base;
  if (signal.source === 'repo-push') {
    return {
      ...base,
      state: 'building',
      label: 'Clawd is cooking',
      reason: `GitHub shows a newer push on ${signal.repo} than the public activity feed has delivered yet.`,
      evidenceUrl: repoUrl(signal.repo),
    };
  }
  const d = describeEvent(recent), evidence = { ...base, reason: `${d.title} in ${recent.repo.name}.`, evidenceUrl: d.url };
  if (recent.type === 'ReleaseEvent' && recent.payload?.action === 'published' && now - ms(recent.created_at) <= CONFIG.celebratingWindowMs) return { ...evidence, state: 'shipping', label: 'A fresh release!' };
  if (['PushEvent', 'PullRequestEvent'].includes(recent.type)) return { ...evidence, state: 'building', label: 'Clawd is cooking' };
  return { ...evidence, state: 'planning', label: 'At the drawing board' };
}
export function timeAgo(value, now = Date.now()) {
  if (!value) return 'No signal yet';
  const seconds = Math.max(0, Math.floor((now - ms(value)) / 1000));
  if (!Number.isFinite(seconds)) return 'Unknown time';
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
