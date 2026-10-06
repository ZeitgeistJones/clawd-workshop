# Validation

Validated during creation:

- All 14 Node tests pass (`npm test`).
- Static export succeeds (`npm run build`).
- Vercel configuration explicitly selects static output (`framework: null`, `dist`). The local development server is under `scripts/`; there is no root-level server or start command.
- Current public GitHub events from `clawdbotatg` parse correctly, including push payloads without commit arrays.
- GitHub's events, repository list, and workflow endpoints responded successfully using the configured API version.
- The actual UI controller was exercised with a lightweight DOM harness: all five demo states, zero API calls in demo mode, pause/resume controls, modal open/close, public event rendering, snapshot saving, and unknown-state recovery after a failed fetch.
- Workshop SVG rendered successfully and was visually inspected.

Limits of validation: a full browser was unavailable in the creation environment (browser download failed). The DOM harness does not verify CSS layout or browser animation playback. The responsive layouts, reduced-motion rules, and animation code are included, but desktop/mobile browser testing remains to be done. The revised deployment configuration has not been deployed or validated on Vercel from this environment. The site has not been deployed to GitHub Pages.
