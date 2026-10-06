// No tokens, accounts, backend, or dependency installation needed.
export const CONFIG = Object.freeze({
  username: 'clawdbotatg',
  displayName: 'Clawd',
  refreshMs: 5 * 60 * 1000,
  activeWindowMs: 45 * 60 * 1000,
  celebratingWindowMs: 15 * 60 * 1000,
  pulseHalfLifeMs: 30 * 60 * 1000,
  cacheKey: 'clawd-workshop-v1',
  replayDurationMs: 5 * 60 * 1000,
  minChapterMs: 7000,
  // Optional exact mappings. Use any kind listed in src/objects.js.
  visualOverrides: {
    'clawdbotatg/clawd-harness': { kind: 'dashboard', label: 'Agent control dashboard' },
  },
});
