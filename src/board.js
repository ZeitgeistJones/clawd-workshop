// Short chalk lines from public GitHub events. Releases, pushes, and merges only.

import { describeEvent, safeGithubUrl } from './activity.js';

const MAX_SUBJECT = 20;

function clip(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function repoShort(name) {
  if (!name || typeof name !== 'string') return '';
  return name.split('/').slice(1).join('/') || name;
}

/** One honest board line, or null when the event is not something he did or shipped. */
export function chalkNote(event) {
  if (!event?.type || !event.repo?.name) return null;
  const described = describeEvent(event);
  const href = safeGithubUrl(described.url, '');
  if (!href.startsWith('https://github.com/')) return null;
  const repo = repoShort(event.repo.name);
  if (!repo) return null;
  let verb = '';
  let extra = '';
  if (event.type === 'ReleaseEvent' && event.payload?.action === 'published') {
    verb = 'shipped';
    extra = event.payload?.release?.tag_name || '';
  } else if (event.type === 'PushEvent') {
    verb = 'pushed';
  } else if (event.type === 'PullRequestEvent' && event.payload?.pull_request?.merged) {
    verb = 'merged';
  } else return null;
  const subject = clip([repo, extra].filter(Boolean).join(' '), MAX_SUBJECT);
  return {
    id: String(event.id || `${event.created_at}:${verb}:${repo}`),
    verb,
    subject,
  };
}

/** Newest first, repeated lines dropped, capped so the board stays a board. */
export function chalkNotes(events, limit = 6) {
  const notes = [];
  const seen = new Set();
  for (const event of events || []) {
    const note = chalkNote(event);
    if (!note) continue;
    const key = `${note.verb} ${note.subject}`;
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push(note);
    if (notes.length >= limit) break;
  }
  return notes;
}
