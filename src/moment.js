// What a touch on the picture can reveal. Public signals only.

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

