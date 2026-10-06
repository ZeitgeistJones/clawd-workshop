// No tokens, accounts, backend, or dependency installation needed.
export const CONFIG = Object.freeze({
  username: 'clawdbotatg',
  displayName: 'Clawdbotatg',
  refreshMs: 5 * 60 * 1000,
  activeWindowMs: 45 * 60 * 1000,
  celebratingWindowMs: 15 * 60 * 1000,
  pulseHalfLifeMs: 30 * 60 * 1000,
  cacheKey: 'clawd-workshop-v1',
  replayDurationMs: 5 * 60 * 1000,
  minChapterMs: 7000,
  market: {
    chainId: 'base', chainHex: '0x2105', symbol: 'CLAWD', decimals: 18,
    token: '0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07',
    rpcUrl: 'https://mainnet.base.org',
    v4Manager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
    // A specific pair can be pinned; otherwise choose the most liquid quoted CLAWD pair.
    pairAddress: '', refreshMs: 30000, watchMs: 20000, confirmations: 12,
    bigBuyUsd: 1000, bigBurnTokens: 1000000,
    // Zero-address burns and dead-address transfers have different labels.
    burnAddresses: ['0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dEaD'],
  },
  // Optional exact mappings. Use any kind listed in src/objects.js.
  visualOverrides: {
    'clawdbotatg/clawd-harness': { kind: 'harness', label: 'Agent harness' },
  },
});
