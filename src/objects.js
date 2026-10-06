import { CONFIG } from './config.js';

export const OBJECT_TYPES = Object.freeze({
  wallet: 'Wallet', bot: 'Robot', dashboard: 'Control dashboard', harness: 'Agent harness',
  simulator: 'Transaction simulator', vault: 'Safe', keypad: 'Keypad', grove: 'Tiny grove', frog: 'Frog',
  bunker: 'Bunker', book: 'Lesson book', newspaper: 'Daily dispatch', microscope: 'Research kit',
  liquidity: 'Liquidity time lock', token: 'Token', web: 'Web crawler', incinerator: 'Workshop fireplace',
  blueprint: 'Project blueprint',
});
const rules = [
  ['wallet', /\b(wallet|wallets|payments?|checkout)\b/],
  ['incinerator', /\b(incinerator|burn|burns|buy.?and.?burn)\b/],
  ['liquidity', /\b(liquidity|vesting|vested|timelock|time lock)\b/],
  ['simulator', /\b(simulator|simulation|txn|transaction)\b/],
  ['keypad', /\b(keypad|keyboard|keyboards|intern)\b/],
  ['vault', /\b(safe|vault|vaults|treasury)\b/],
  ['grove', /\b(grove|garden|forest|trees?)\b/],
  ['frog', /\b(frog|frogs|toad)\b|fomo/],
  ['bunker', /\b(bunker|shelter|fort|containers?)\b/],
  ['microscope', /\b(research|science|laboratory|lab)\b/],
  ['newspaper', /\b(daily|morning|news|dispatch|updates?|twitter|proxy)\b/],
  ['book', /\b(lessons?|learn|learning|education|book|chronicle|tutorial)\b/],
  ['web', /\b(crawler|crawl|scraper|spider)\b/],
  // Prefer a literal harness when the name asks for one; dashboards stay screens.
  ['harness', /\bharness(es)?\b/],
  ['dashboard', /\b(dashboard|console|control panel|tracker|monitor)\b/],
  ['bot', /\b(robot|robots|bot|bots|agent|agents|automation)\b/],
  ['token', /\b(token|tokens|coin|coins)\b/],
];
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
