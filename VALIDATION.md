# Validation

Validated during creation:

- All 33 Node tests pass (`npm test`), including controller integration tests using a small DOM harness.
- The browser fetch receiver error was reproduced with a strict receiver regression test. It failed with the original constructor and passes when the default fetch is bound to `globalThis`.
- Static export succeeds (`npm run build`).
- Vercel configuration explicitly selects static output (`framework: null`, `dist`). The local development server is under `scripts/`; there is no root-level server or start command.
- Current public GitHub events from `clawdbotatg` parse correctly, including push payloads without commit arrays.
- GitHub's events, repository list, and workflow endpoints responded successfully using the configured API version.
- The actual UI controller was exercised with a lightweight DOM harness: all five demo states, zero API calls in demo mode, pause/resume controls, modal open/close, public event rendering, snapshot saving, and unknown-state recovery after a failed fetch.
- Workshop SVG rendered successfully and was visually inspected.
- All 16 project props rendered successfully and were visually inspected.
- Replay tests cover the rolling 24-hour boundary, event grouping and deduplication, partial feed coverage, page failures, dense-day pacing, sparse-day duration caps, seek boundaries, and object classification.
- Controller tests cover replay playback, pause, scrubbing to completion, restart, chapter navigation, duration changes, switching modes, and pausing a hidden tab. The nine-project demo fits the default five-minute target.

Limits of validation: a full browser was unavailable in the creation environment (browser download failed). The DOM harness does not verify CSS layout or browser animation playback. The responsive layouts, reduced-motion rules, and animation code are included, but desktop/mobile browser testing remains to be done. The revised deployment configuration has not been deployed or validated on Vercel from this environment. The site has not been deployed to GitHub Pages.
