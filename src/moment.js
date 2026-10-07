// The day outside the window, a knock, and a postcard of this moment.
// Public signals only. Nothing here claims live keystrokes or presence.

import { describeEvent, safeGithubUrl, timeAgo } from './activity.js';

export const BIRD_LIMIT = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const RETURN_GAP_MS = 30 * 60 * 1000;

// Four panes of the workshop window, plus two that sit off the mullion.
const SLOTS = [
  { x: 22, y: 28 },
  { x: 74, y: 24 },
  { x: 26, y: 70 },
  { x: 76, y: 68 },
  { x: 40, y: 16 },
  { x: 58, y: 82 },
];

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

export function selectWindowBirds(events, now = Date.now(), limit = BIRD_LIMIT) {
  const picked = [];
  const cap = Math.max(0, limit);
  for (const event of events || []) {
    if (picked.length >= cap) break;
    const at = Date.parse(event?.created_at);
    if (!event?.id || !Number.isFinite(at) || at > now + 60_000 || now - at > DAY_MS) continue;
    let described;
    try { described = describeEvent(event); } catch { continue; }
    if (!described?.title || !described.repo) continue;
    const slot = SLOTS[picked.length % SLOTS.length];
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
      x: slot.x,
      y: slot.y,
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

export function postcardCaption({ line, repo, demo, replay, href }) {
  const where = repoShort(repo) || 'the workshop';
  const stamp = demo
    ? 'Sample activity, not a live feed.'
    : replay
      ? 'A moment from the public replay.'
      : 'Public GitHub signals, not a live camera.';
  return `${line} ${stamp} ${where}. ${href || ''}`.replace(/\s+/g, ' ').trim();
}

export function postcardModel(detail, href) {
  const demo = !!detail?.demo;
  const replay = detail?.mode === 'replay';
  const line = momentLine(detail?.status, { demo, replay });
  const repo = detail?.status?.repo || '';
  const checked = Date.parse(detail?.data?.checkedAt || '');
  const when = Number.isFinite(checked)
    ? new Date(checked).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';
  return {
    line,
    project: repoShort(repo),
    stamp: demo ? 'SAMPLE · not live data' : replay ? 'REPLAY · public history' : 'PUBLIC SIGNALS · not a camera',
    when,
    href: href || '',
    caption: postcardCaption({ line, repo, demo, replay, href }),
  };
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

// Draws a 1200×630 card. Caller sets canvas size. Uses fillText only.
export function paintPostcard(ctx, model) {
  const w = 1200;
  const h = 630;
  ctx.fillStyle = '#e7efe9';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d5e3da';
  ctx.fillRect(0, 0, 420, h);
  ctx.fillStyle = '#c9b89a';
  ctx.fillRect(0, 470, 420, 160);
  ctx.fillStyle = '#bb8f5d';
  ctx.fillRect(48, 430, 324, 22);

  ctx.beginPath();
  ctx.moveTo(210, 150);
  ctx.lineTo(108, 360);
  ctx.quadraticCurveTo(210, 410, 312, 360);
  ctx.closePath();
  ctx.fillStyle = '#e66850';
  ctx.fill();
  ctx.fillStyle = '#fffcf4';
  ctx.beginPath();
  ctx.ellipse(168, 268, 22, 16, -0.2, 0, Math.PI * 2);
  ctx.ellipse(246, 262, 22, 16, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#263a36';
  ctx.beginPath();
  ctx.arc(174, 268, 7, 0, Math.PI * 2);
  ctx.arc(250, 262, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#893f35';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(156, 310);
  ctx.quadraticCurveTo(210, 338, 268, 304);
  ctx.stroke();

  ctx.fillStyle = '#5d6a63';
  ctx.font = '600 18px "DM Sans", sans-serif';
  ctx.fillText('CLAWD WORKSHOP', 480, 120);
  ctx.fillStyle = '#24312c';
  ctx.font = '400 52px Georgia, serif';
  const lines = wrapLines(ctx, model.line, 640);
  lines.forEach((line, i) => ctx.fillText(line, 480, 200 + i * 64));
  ctx.fillStyle = '#3f6a51';
  ctx.font = '600 28px "DM Sans", sans-serif';
  if (model.project) ctx.fillText(model.project, 480, 470);
  ctx.fillStyle = '#5d6a63';
  ctx.font = '16px "DM Sans", sans-serif';
  ctx.fillText(model.stamp, 480, 520);
  const foot = [model.when, model.href].filter(Boolean).join('  ·  ');
  ctx.fillText(foot, 480, 556);
}
