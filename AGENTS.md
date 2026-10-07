# Clawd Workshop project instructions

Read `README.md` for behavior and setup, `CURSOR.md` for the requested validation workflow, and `VALIDATION.md` for what has actually been tested.

## Architecture

This is a dependency-free static app: native JavaScript ES modules, HTML, CSS, and scalable SVG. The GitHub-ready source must work on GitHub Pages and Vercel. Keep this architecture for ordinary fixes and UI improvements; a framework/backend migration requires a separate user request.

Use Node.js 22 or newer. Commands: `npm run dev` (http://localhost:3000), `npm test`, and `npm run build` (exports `dist/`). No npm install is required for the current project.

Local development server: `scripts/dev-server.mjs`. Vercel config: `framework: null`, `buildCommand: npm run build`, `outputDirectory: dist`. Do not restore a root `server.mjs` or add a `start` script that can confuse deployment detection. Do not modify generated `dist/` files.

## Product behavior to preserve

- Track `clawdbotatg` by default. Show public GitHub signals and evidence, not a claim of live keystrokes, productivity, or guaranteed presence.
- Current mode polls every five minutes while visible, respects server polling advice, handles errors/backoff, and labels saved data. Default fetch must remain bound to `globalThis` to avoid the browser's Illegal invocation error.
- Replay is admin-only (`/?admin=1`). It covers available public events in a rolling 24-hour window, with a default five-minute target and two/eight-minute options. Work chapters summarize adjacent updates to the same repo; project switches and published releases remain distinct.
- Each chapter gets at least seven seconds. Work chapters cap at thirty seconds and gaps at ten. Dense days can extend, sparse days can shorten. Pause, seek, previous/next, chapter selection, duration changes, restart, and hidden-tab pausing must remain functional.
- Replay freezes its historical data and stops current polling. Never project current workflow runs into historical chapters or invent past testing states. The replay shelf contains only projects reached so far.
- History pagination stops after three 100-event pages, or once the day is covered/feed ends. Merge and deduplicate locally observed day events. Label partial coverage and page failures; private or delayed work stays invisible.
- Demo data must remain explicitly labeled and must not trigger GitHub requests.

## Visuals

Keep Clawd's cute red triangular face, sly eyes, claws, bow tie, and apron. Preserve the warm, clean workshop palette and consistent SVG line style. Work on the project's actual visual metaphor: wallet, robot, dashboard, harness, safe, keypad, grove, frog, bunker, book, newspaper, microscope, liquidity time lock, coin stack, web crawler, or a blueprint. Prefer a literal prop when the name asks for one (a harness is a harness).

Matching lives in `src/objects.js`, artwork in `public/objects.svg`, and precise per-repo overrides in `src/config.js`. Infer from repo name/description/topics or use an explicit mapping. Label inferred illustrations; unknown types use a blueprint. Do not call these metaphors actual screenshots of software.

Keep relative asset paths, mobile layouts, accessible control labels, keyboard seeking, reduced-motion support, and the animation pause control. Render API text with `textContent`; keep event URLs restricted to HTTPS GitHub links.

## Validation

Run relevant tests and the static build after functional changes. Test the UI in a real browser when available: native fetch, external SVG fragments, layout, animation, replay transitions, and mobile overflow. The built-in DOM harness verifies controller behavior but does not prove browser layout or rendering works. Record remaining limitations honestly in `VALIDATION.md` and the change summary. Add regression coverage for meaningful bugs, not assertions that merely repeat the implementation.

## Social sharing

Keep sharing metadata in delivered HTML, not client-side JavaScript. `scripts/share-metadata.mjs` resolves `SITE_URL` or the stable Vercel production domain at build time and preserves repository subpaths. The main link is an image card. `public/share/index.html` is a separate video card with a public HTTPS player and MP4 clip. Keep its demo labeling and PNG fallback. Platform playback and caching need deployment verification; don't claim embedded playback is guaranteed.

## Lounge, audio, market, and chat behavior

Keep the workshop large and readable, with meaningful repository context and linked evidence. Render API descriptions and commit titles using textContent. Do not show present-day commits as historical replay evidence.

Public workshop chat is display-name only (no accounts). It uses Vercel `/api/chat` and Upstash Redis keys namespaced `clawd-workshop:chat:*`. Sanitize with textContent on the client, rate-limit posts, keep a short rolling history, and fail honestly when Redis env vars are missing. Never put Redis secrets in the static client.

Workshop radio plays local MP3 tracks from `public/music/` listed in `src/playlist.js`. One shared live loop for everyone: wall-clock schedule through the playlist (include each track’s `duration` in seconds). Auto-start with sound on load. No page-wide “tap anywhere for sound” gate. If the browser blocks unmuted autoplay, keep the live loop going and let the speaker control unmute. No pause control—mute/unmute only; join mid-track instead of restarting; retain volume; keep playing when the tab is hidden; stop on pagehide; recover from unsupported or blocked audio. To add a song: drop the file in `public/music/` and append one `TRACKS` entry with `duration`.

Price and transaction feeds are distinct. Validate token/chain, require pool Swap logs for buy reactions, distinguish zero-address burns from sink transfers, estimate USD only from a fresh quote, deduplicate logs, and establish a baseline without historical celebrations. Suppress current market effects in replay. Show stale/unavailable/partial states. Never expose RPC secrets in the static client, invent live activity, or claim end-to-end feed validation without testing.
