# Validation

## Playlist radio · October 6, 2026

- Removed generative Web Audio stations. Radio plays local MP3s from
  `public/music/` via `src/playlist.js` (`fwahh`, `Slop Lessons`).
- Shared live loop: wall-clock schedule so listeners join mid-track together.
  Auto-starts with sound on load (mute-only control). If autoplay is blocked, waits
  for a tap and starts unmuted instead of staying muted-while-playing.
  Keeps playing when the tab is hidden; stops on pagehide.
- Studio / 01 overlay removed; scene fill tightened to reduce fringe borders.
- Node tests cover schedule math and blocked play recovery. Speaker sync still
  needs a real two-browser listen after deploy.

## Workshop chat · October 6, 2026

- Public room behind `/api/chat` on Vercel. Display name only (localStorage), no
  accounts. Messages live in Upstash Redis under `clawd-workshop:chat:*`.
- Rate-limited (~3s/IP), capped length, last 80 messages kept. Missing Redis env
  returns a clear 503 instead of inventing a room.
- Node unit tests cover sanitization, posting, and rate limits. End-to-end chat
  on production still needs the two Upstash env vars on the clawd-workshop
  Vercel project and a live browser pass after deploy.

## Bench hover card + cooler palette · October 6, 2026

- Hovering (or focusing) the bench prop shows Build Report economics/builder
  grades when curated, plus GitHub and Build Report links. Untagged repos show
  a short “not curated yet” note with the same links.
- Page chrome shifted from warm beige to mist/sage; workshop wall and light
  wash cooled. Wood bench/floor still read as warm wood.
- Node tests and static export should be re-run after this change; browser hover
  path needs a real Chromium pass on the prop.

## Visual refresh · October 6, 2026

- Merged `clawd-workshop-visual-refresh.zip` into the live checkout (index.html studio
  room, `src/studio.css` / `src/studio.js`, local `public/fonts/`). Lounge, market,
  music, replay, sharing, and Build Report logic were left intact; only
  `import './studio.js';` was added to `src/app.js`. Removed the package wall clock
  and framed chart so the burn fireplace stays the clear background reaction.
- All 48 existing Node tests pass; the static export succeeds.
- Original source came from the supplied Repomix snapshot. Its omitted share
  PNG/MP4 were fetched from the same repository and preserved.
- Chromium 138 browser checks passed at widths 320, 390, 600, 768, 920, 1024,
  1440, and 1920 with no horizontal page overflow.
- Desktop and phone screenshots were visually inspected. The five sample
  states retain their props; safety goggles, shipping box, and sleepy eyes appear.
- Locally served DM Sans and Lora, including the italic face, load successfully.
- Focus view retains the exact scene node and pause state, contains keyboard
  focus, closes with Escape or its button, and restores focus to that button.
- Radio creates no AudioContext on load. A user click starts a running context;
  pause updates the controls. Speaker output was not listened to.
- Sample buy and burn reactions remain distinct. The 25-million-token sample
  burn displays the level-three fireplace. No real transaction was claimed.
- Admin sample replay plays, pauses, seeks, advances between chapters, updates
  project context, suppresses current market effects, and returns to current mode.
- Explanation and score-card dialogs open and close. Reduced-motion preference
  stops both the character and the new ambient animation.
- A fresh visit with external requests blocked shows an unknown signal and no
  invented project. Public admin controls remain hidden.
- No JavaScript page errors occurred in these browser checks.
- This source package has not been pushed or deployed. Production provider,
  crawler, and audio-listening checks remain as described below.

## Earlier implementation checks

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
- Scene focus: pegboard/tools, plant, and score shelf removed; window + full fireplace remain. Fireplace stays cold until burns; `data-burn-level` 1–3 scales flame size from token amount (demo burn uses the burn-threshold input).
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
