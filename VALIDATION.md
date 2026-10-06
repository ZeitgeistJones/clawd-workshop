# Validation

Validated during creation and merge:

- Node tests pass (`npm test`), including controller integration tests using a small DOM harness and sharing URL helpers.
- The browser fetch receiver error was reproduced with a strict receiver regression test. It failed with the original constructor and passes when the default fetch is bound to `globalThis`.
- Static export succeeds (`npm run build`).
- Vercel configuration explicitly selects static output (`framework: null`, `dist`). The local development server is under `scripts/`; there is no root-level server or start command.
- Replay is available only with `/?admin=1`. Public UI tests confirm the admin shell stays hidden without that flag.
- Replay tests cover the rolling 24-hour boundary, event grouping and deduplication, partial feed coverage, page failures, dense-day pacing, sparse-day duration caps, seek boundaries, and object classification.
- Controller tests cover replay playback, pause, scrubbing to completion, restart, chapter navigation, duration changes, switching modes, and pausing a hidden tab.
- Sharing tests cover stable production URLs, base paths, invalid URL rejection, and image fallback when the deployment URL is unavailable.
- The 1200×630 PNG preview and 12-second MP4 demo are included under `public/`.

Limits of validation: platform social-card rendering, in-feed video playback, and crawler caching require post-deploy checks. Player metadata does not guarantee embedded video playback on X or other apps. SSO/deployment protection on Vercel can block crawlers if misconfigured.
