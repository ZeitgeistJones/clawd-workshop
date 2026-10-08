import { CONFIG } from './config.js';

export const OBJECT_TYPES = Object.freeze({
  wallet: 'Wallet', bot: 'Robot', dashboard: 'Control dashboard', harness: 'Agent harness',
  simulator: 'Transaction simulator', vault: 'Safe', keypad: 'Keypad', grove: 'Tiny grove', frog: 'Frog',
  bunker: 'Bunker', book: 'Lesson book', newspaper: 'Daily dispatch', microscope: 'Research kit',
  liquidity: 'Liquidity time lock', token: 'Token', web: 'Web crawler', incinerator: 'Workshop fireplace',
  undies: 'Pair of undies', computer: 'Desktop computer', calendar: 'Wall calendar', buttons: 'Big buttons',
  checklist: 'Todo checklist', quill: 'Quill and ink', mic: 'Microphone', chess: 'Chess piece',
  crops: 'Crop sprouts', gamepad: 'Game pad', blueprint: 'Project blueprint',
});

// First match wins. Put more specific title words ahead of broad ones (wedgie, agent, token…).
const rules = [
  ['wallet', /\b(wallet|wallets|payments?|checkout)\b/],
  ['incinerator', /\b(incinerator|burn|burns|buy.?and.?burn)\b/],
  ['liquidity', /\b(liquidity|vesting|vested|timelock|time lock)\b/],
  ['simulator', /\b(simulator|simulation|txn|transactions?)\b/],
  ['keypad', /\b(keypad|keyboard|keyboards|intern)\b/],
  ['vault', /\b(safe|vault|vaults|treasury)\b/],
  ['grove', /\b(grove|garden|forest|trees?)\b/],
  ['frog', /\b(frog|frogs|toad)\b|fomo/],
  ['bunker', /\b(bunker|shelter|fort|containers?)\b/],
  ['computer', /\b(computer|desktop|macintosh|imac)\b/],
  ['calendar', /\b(calendar|calendly|scheduler|schedule)\b|\bcal\b/],
  ['buttons', /\b(buttons?|arcade)\b/],
  ['checklist', /\b(todo|todos|checklist|tasks?)\b/],
  ['quill', /\b(quill|scribe|signing|signature|nat.?spec)\b/],
  ['mic', /\b(voice|dictate|dictation|microphone|mic)\b/],
  ['chess', /\bchess\b/],
  ['crops', /\b(crops?|harvest|sprouts?)\b/],
  ['gamepad', /\b(gamepad|joystick)\b|\bgames?\b|games/],
  ['microscope', /\b(research|science|laboratory|lab)\b/],
  ['newspaper', /\b(daily|morning|news|dispatch|twitter|proxy)\b/],
  ['book', /\b(lessons?|learn|learning|education|book|chronicle|tutorial|papers?)\b/],
  ['web', /\b(crawler|crawl|scraper|spider)\b/],
  // Prefer a literal harness when the name asks for one; dashboards stay screens.
  ['harness', /\bharness(es)?\b/],
  ['dashboard', /\b(dashboard|console|control panel|tracker|monitor)\b/],
  ['bot', /\b(robot|robots|bot|bots|agent|agents|automation)\b/],
  ['token', /\b(token|tokens|coin|coins)\b/],
  // After more specific wedgie-* props (safe, frog, buttons…). A bare wedgie gets underwear.
  ['undies', /\b(wedgie|undies|underwear|briefs|panties)\b/],
];

/** A picture keeps its debut glow only for the first day after GitHub says the repo was created. */
export const REPO_DEBUT_MS = 24 * 60 * 60 * 1000;

export function repoIsNew(createdAt, now = Date.now()) {
  const created = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt || '');
  if (!Number.isFinite(created) || !Number.isFinite(now)) return false;
  const age = now - created;
  return age >= -2 * 60 * 1000 && age < REPO_DEBUT_MS;
}

function words(value) { return String(value || '').toLowerCase().replace(/[-_./]/g, ' '); }
export function projectObject(repoName, metadata = {}) {
  const override = CONFIG.visualOverrides?.[repoName];
  if (override && Object.hasOwn(OBJECT_TYPES, override.kind)) return {
    kind: override.kind, label: override.label || OBJECT_TYPES[override.kind], basis: 'Project illustration · configured for this repo', known: true,
  };
  const sources = [
    ['repository name', words(repoName?.split('/').slice(1).join('/'))],
    ['repository description', words(metadata.description)],
    ['repository topics', words((metadata.topics || []).join(' '))],
  ];
  for (const [source, content] of sources) {
    const match = rules.find(([, pattern]) => pattern.test(content));
    if (match) return { kind: match[0], label: OBJECT_TYPES[match[0]], basis: `Project illustration · inferred from ${source}`, known: true };
  }
  return { kind: 'blueprint', label: 'Project blueprint', basis: 'Project type unclear · showing its blueprint', known: false };
}
