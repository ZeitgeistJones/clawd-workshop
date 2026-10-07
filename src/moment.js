// What a touch on the picture can reveal. Public signals only.

import { describeEvent, safeGithubUrl, timeAgo } from './activity.js';

export const WINDOW_NOTE_LIMIT = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const RETURN_GAP_MS = 30 * 60 * 1000;

const STATUS_LINES = {
  building: repo => (repo ? `Hammer's out on ${repo}.` : `Hammer's out.`),
  planning: repo => (repo ? `Sketching ${repo}.` : `At the drawing board.`),
  testing: repo => (repo ? `Goggles on for ${repo}.` : `Goggles on.`),
  shipping: repo => (repo ? `${repo} is boxed.` : `Boxed and ready.`),
  idle: () => `Resting. The lamp stays on.`,
  unknown: () => `Checking the public feed…`,
};

function repoShort(name) {
  if (!name || typeof name !== 'string') return '';
  return name.split('/').slice(1).join('/') || name;
}

export function selectWindowNotes(events, now = Date.now(), limit = WINDOW_NOTE_LIMIT) {
  const picked = [];
  const cap = Math.max(0, limit);
  for (const event of events || []) {
    if (picked.length >= cap) break;
    const at = Date.parse(event?.created_at);
    if (!event?.id || !Number.isFinite(at) || at > now + 60_000 || now - at > DAY_MS) continue;
    let described;
    try { described = describeEvent(event); } catch { continue; }
    if (!described?.title || !described.repo) continue;
    const repo = repoShort(described.repo);
    const url = safeGithubUrl(described.url, 'https://github.com');
    picked.push({
      id: String(event.id),
      title: described.title,
      repo,
      detail: described.detail || '',
      url,
      time: described.time,
      when: timeAgo(described.time, now),
      label: `${described.title}. ${repo}. ${timeAgo(described.time, now)}.`,
    });
  }
  return picked;
}

export function momentLine(status, { demo = false, replay = false } = {}) {
  const repo = repoShort(status?.repo);
  const speak = STATUS_LINES[status?.state] || STATUS_LINES.unknown;
  const line = speak(repo);
  if (demo) return `Sample · ${line}`;
  if (replay) return `Replay · ${line}`;
  return line;
}

export function knockLine(state) {
  switch (state) {
    case 'building': return `One second. Mid-swing.`;
    case 'planning': return `Come look. The ink's wet.`;
    case 'testing': return `Don't touch the machine.`;
    case 'shipping': return `You're just in time.`;
    case 'idle': return `Oh. I was resting my eyes.`;
    default: return `Kettle's on. News is late.`;
  }
}

export function returnNote(previous, current, now = Date.now()) {
  if (!previous || !Number.isFinite(Number(previous.at))) return '';
  if (now - Number(previous.at) < RETURN_GAP_MS) return '';
  const repo = repoShort(current?.repo);
  const prevRepo = repoShort(previous.repo);
  const sameSignal = current?.latestId && previous.latestId && String(current.latestId) === String(previous.latestId);
  if (sameSignal) {
    return repo
      ? `Same bench as when you left. Still ${repo}, and nothing newer in the public feed.`
      : `Nothing newer in the public feed since you last looked.`;
  }
  if (repo && prevRepo && repo !== prevRepo) {
    return `Since you last looked, the bench moved from ${prevRepo} to ${repo}.`;
  }
  if (current?.latestId && String(current.latestId) !== String(previous.latestId || '')) {
    return repo
      ? `Something new since you last looked. Latest public signal is on ${repo}.`
      : `Something new landed in the public feed since you last looked.`;
  }
  return '';
}

export function visitSnapshot(detail, now = Date.now()) {
  const events = detail?.allEvents || [];
  return {
    at: now,
    latestId: events[0]?.id ? String(events[0].id) : '',
    repo: detail?.status?.repo || '',
    state: detail?.status?.state || '',
  };
}

