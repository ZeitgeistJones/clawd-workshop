# Validation

Validated during creation:

- All Node tests pass (`npm test`), including controller integration tests using a small DOM harness.
- The browser fetch receiver error was reproduced with a strict receiver regression test. It failed with the original constructor and passes when the default fetch is bound to `globalThis`.
- Static export succeeds (`npm run build`).
- Vercel configuration explicitly selects static output (`framework: null`, `dist`). The local development server is under `scripts/`; there is no root-level server or start command.
- Current public GitHub events from `clawdbotatg` parse correctly, including push payloads without commit arrays.
- Replay is available only with `/?admin=1`. Public UI tests confirm the admin shell stays hidden without that flag.
- Replay tests cover the rolling 24-hour boundary, event grouping and deduplication, partial feed coverage, page failures, dense-day pacing, sparse-day duration caps, seek boundaries, and object classification.

Sharing update validation:

- Sharing tests cover stable production URLs, base paths, invalid URL rejection, and image fallback when the deployment URL is unavailable.
- Share card copy uses **What is Clawdbotatg Building?** and **little guy, big ideas.**
- Actual public crawler access, social cards, in-feed video playback, and browser video playback still require deployment validation.

Lounge update validation (merged zip 4 into the live checkout, preserving admin replay, sharing copy, and Build Report score shelf):

- All 48 tests pass after merge. Coverage includes safe build context, original audio scores and failed-start recovery, V3/V4 swap signs, token/chain/pair matching, stale price rejection, burn-versus-sink classification, watcher baseline/retry/dedup, RPC chain/decimal rejection, demo market isolation, and score-card dialog open/close.
- Static build succeeds.
- Desktop browser check at `http://localhost:3000`: larger workshop, radio illustration, build brief with commit links, market panel, score shelf/chips, and score-card dialog.
- Mobile check at 390×844: stacked layout, readable headlines, workshop and brief readable without horizontal overflow in the first viewport.
- Lo-fi radio: silent until Play; after click UI shows `72 BPM · original generative lo-fi`, `aria-pressed=true`, and `music-playing` on the scene. Audio is Web Audio synthesis (cannot prove speaker output from this agent environment beyond a running AudioContext path).
- Live DEX Screener quote succeeded in the browser (`$CLAWD` price, 24h change, volume, liquidity). Selected Uniswap V4 pool `0x9fd58e73…aa8ce` on Base.
- Live Base RPC (`https://mainnet.base.org`) returned chain id `0x2105` and allowed log reads when paced. Aggressive parallel `eth_getLogs` hit provider rate limit `-32016`; the in-app watcher uses small ranges and backoff.
- Transaction decoding against real evidence: in a ~200-block window, 2 V4 Swap logs were fetched; decoder classified 1 buy-side swap — tx [`0x232c96f7efe8101ab6245a5ebcf8f11ffa640f8a40fc55f297cc6c8b0ce3bc8c`](https://basescan.org/tx/0x232c96f7efe8101ab6245a5ebcf8f11ffa640f8a40fc55f297cc6c8b0ce3bc8c) (~107M CLAWD ≈ $701 at the fetched quote). That is below the default $1,000 celebration threshold, so the live UI correctly would not celebrate it. No threshold-crossing buy or burn was observed during the short watch window.
- Demo Preview buy / Preview burn labeled sample events and scene effects; demo mode made no market HTTP requests (harness + browser).
- Fix applied during merge: after the first successful quote, kick the chain watcher immediately instead of waiting a full watch interval.

Remaining limits:

- Unauthenticated GitHub quota can leave the public page on a saved snapshot during local multi-refresh testing.
- No live on-page celebration of a real ≥$1,000 buy or ≥1,000,000-token burn was observed in this session (quiet window / threshold).
- Social preview and Vercel production deployment still need post-deploy checks.
- Speaker-level listening of the lo-fi mix should be confirmed on the deployed site or local machine speakers.
