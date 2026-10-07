# Is Clawd building?

A complete, dependency-free web app for watching `clawdbotatg`'s public GitHub activity. A cute red triangular Clawd works in an animated SVG garage; the data changes his behavior. Watch current signals or replay the available last 24 hours as a paced recap. The object on the bench changes with the project: wallets, robots, dashboards, safes, books, and more. Responsive on desktop and phone.

**Using Cursor?** Open [CURSOR.md](CURSOR.md) for setup, a ready-to-paste Agent prompt, and instructions for updating your existing GitHub/Vercel project. `AGENTS.md` and `.cursor/rules/workshop.mdc` provide project context for the agent.

## Workshop lounge update

The workshop now leads a wider dashboard, with larger text, warmer cards, an illustrated radio, and a full build brief below the scene. Briefs show the repository description, language, license, topics, project website when provided, and linked recent commit messages. The shelf includes six repositories with descriptions. Extra active-repository context is cached for ten minutes. During replay, the changes stay tied to chapter events; current commits are not shown as historical work.

**Music:** Workshop Radio auto-starts a shared live loop from `public/music/` (listed in `src/playlist.js`). Mute/unmute only—no pause. Volume is adjustable. Music keeps going when the tab is hidden. Browser autoplay rules may start muted until the first tap.

**Market:** the panel tracks $CLAWD on Base (`0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07`), verified from the builder's [token-hub repository](https://github.com/clawdbotatg/clawd-token-hub). DEX Screener quotes refresh every 30 seconds while visible; the selected pair is the most liquid correctly matched Base pair unless pinned in `src/config.js`. Its mini chart shows samples collected since this page opened, not fabricated historical candles. Failed quotes retain a clearly labeled saved value.

New transaction logs are polled through a public Base RPC with a 12-block observation delay. First load establishes a baseline instead of celebrating old activity. Buy effects require a buy-side Uniswap V3 or V4 Swap log from the selected pool; ordinary transfers and changes in aggregate buy counts cannot trigger them. Values in USD are estimates using the fetched token price, and stale quotes disable USD-threshold buy reactions. Burns use this token's Transfer logs to the zero address; transfers to the dead address have a separate label and are not claimed to reduce total supply. Other markets and unsupported pool formats have no buy decoder.

Defaults are approximately **$1,000 per buy-side swap** and **1,000,000 CLAWD per burn/sink transfer**. Change the thresholds in Workshop reactions or configure defaults in `src/config.js`. Threshold edits last for this visit. Effects include Clawd's buy celebration and a small token/fire animation for burns, with transaction links in the panel. Disable effects independently; animation pause and reduced-motion settings are respected. Market data stays current during historical replay, with scene reactions suppressed so current transactions do not become historical events. Demo mode has explicit sample prices and Preview buy/burn buttons, and initiates no market requests.

Public RPC and price endpoints can have rate limits, downtime, or browser CORS restrictions. Both feeds retry with backoff and show unavailable states; they never silently substitute demo activity. The default provider is best effort. For a production site, Cursor should verify browser access and, if needed, configure a reliable public browser-accessible Base endpoint. Never put a secret RPC credential in front-end source. This environment returned 403s for the real price/RPC endpoints, so this update has **not** been verified against a live market feed. Recent-log watching is partial rather than an all-time burn or buy ledger; long connection gaps can skip old blocks, with a visible notice.

## Update your existing Vercel project

Unzip the new archive and upload its contents into the same GitHub repo, replacing matching files and preserving the folder structure. New lounge files include `src/lounge.js`, `src/lounge.css`, `src/builds.js`, `src/music.js`, `src/market.js`, and their tests. Earlier replay and sharing files are also included. Existing `index.html`, the JavaScript/CSS files, `package.json`, and docs have also changed; upload the whole project rather than just one file. Keep `vercel.json`. If the old root `server.mjs` still exists, delete it.

Commit the upload; your connected Vercel project can deploy the new commit. Once that deployment is ready, reload the site. Replay lives under the admin tools: open `/?admin=1`, then use **Replay 24 hours**.

## Drop it into GitHub

1. Unzip this project.
2. Create a GitHub repository. Upload the **contents** of `clawd-workshop/` to its root, so `index.html`, `src/`, and `public/` sit at the top level. You can drag them into GitHub's **Add file → Upload files** screen. Commit the upload.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**. Select your branch (usually `main`) and **/(root)**, then save.
5. GitHub will show the published URL when the deployment finishes: `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

No GitHub token, image generation, database, account system, paid API, or npm install is needed. All URLs are relative, so repository subpaths work. Include `.nojekyll` when using git; the app also works with GitHub's default Pages processing if the upload screen skips that empty dotfile.

**This download is source code. No repository or public site has been created for you.**

## Run locally

Install Node.js 22 or newer. From the project folder:

```sh
npm run dev
```

Open `http://localhost:3000`. Run `npm test` for the built-in tests. There are no dependencies to install. ES modules need an HTTP server; double-clicking the HTML using `file://` will not work.

You can also serve the folder with `python3 -m http.server 3000`.

## Other static hosts

`npm run build` creates `dist/` with only deployable files. On Cloudflare Pages or Netlify, use build command `npm run build`, output directory `dist`, and Node 22+. On Vercel, the included `vercel.json` selects the Other preset, build command `npm run build`, and output `dist`. No rewrite rules are needed. A GitHub Pages branch deployment does not require the build step.

### Vercel setup and recovery

Import your GitHub repo into Vercel. Set the root directory to the folder containing `package.json` and `vercel.json`. Framework Preset must be **Other**. The config file supplies the build command and output directory.

If you uploaded the earlier archive, update `package.json`, add `vercel.json`, delete the old root-level `server.mjs`, and upload `scripts/dev-server.mjs`. The development server now lives under `scripts/` and is used only for local previews. This is a static app and does not need a Vercel Function.

Commit those changes, check that the project uses **Other**, then deploy the new commit. A `FUNCTION_INVOCATION_FAILED` page means a function crashed; it does not identify the exact underlying exception. The configuration above removes the need for a server function. If that error persists on the new deployment, open Vercel's **Logs** to inspect the failed invocation and confirm you're opening the latest deployment URL.

If an earlier version shows `Failed to execute 'fetch' on 'Window': Illegal invocation`, update `src/github.js`. Its constructor now uses `fetcher = globalThis.fetch.bind(globalThis)` so browser fetch receives the correct global context. Commit the change, wait for the new deployment, and refresh. This issue does not require a GitHub token.

## Link previews and video sharing

The main workshop link has a 1200×630 PNG preview of Clawd, a title, and a description. Open Graph and X metadata are written into the HTML during the static build; social crawlers do not need to run the app's JavaScript.

On Vercel, the build uses `VERCEL_PROJECT_PRODUCTION_URL` for stable absolute links. Enable access to system environment variables in the project's settings if disabled. For a custom domain or another host, set the build environment variable `SITE_URL` to your full public HTTPS address, including a repository subpath when applicable, then rebuild. Example: `SITE_URL=https://example.com/workshop/ npm run build`. For GitHub Pages, deploy the contents of that built `dist/`; direct source-only deployment does not have fully configured sharing URLs. Do not set this to a private preview deployment or localhost.

For video sharing, use `https://YOUR-DOMAIN/public/share/index.html` (after your base path, if any). This separate page includes a 12-second MP4 demo, Open Graph video tags, and X Player Card metadata pointing to `public/share/player.html`. It retains a poster image. The main workshop link keeps its ordinary image card. The clip is a labeled demo animation with wallet, robot, and safe objects, not a recording of actual GitHub work or today's replay.

The sharing app controls image rendering, video playback, autoplay, approval, and caching. Player tags do not guarantee X or another app will display an embedded video. To post a video directly on X, upload `public/workshop-preview.mp4` with the post and include the workshop link in its text. After deployment, check the fetched HTML and image/video/player URLs without authentication, then test an actual shared link. Cached previews may take time to update. This package has not been deployed or tested in a social feed.

## See every animation

Click **Try demo**, then choose Building, Planning, Testing, Shipping, or Quiet. The entire dashboard is labeled **DEMO · SAMPLE ACTIVITY**. Alternatively open `http://localhost:3000/?demo=1`. Demo does not fetch GitHub data. Returning to GitHub fetches real activity; failed requests never silently switch to demo.

Clawd is drawn in SVG and animated with CSS. He retains the reference character's red triangular face, sly eyes, mischievous smile, bow tie, and claws, with a little workshop apron. Social sharing assets are included as a PNG poster and MP4 demo; the app itself uses SVG. The pause button stops motion; reduced-motion preferences are respected.

## Replay the last 24 hours (admin)

Replay is hidden from the public page. Open `/?admin=1` (or `/?demo=1&admin=1` for a sample day). The Admin tab and Workshop / Replay controls appear. Click **Replay 24 hours**. Playback starts after the history loads. Choose **2, 5, or 8 minutes** as your target duration (default: five). The day is a rolling 24-hour window ending when you load it, shown in your browser's local time.

- Nearby events for the same repository are grouped into chapters when no more than 30 minutes apart. Project switches and published releases remain separate chapters. Every fetched event appears in its chapter's evidence list.
- Each chapter stays on screen for at least **7 seconds**. Work chapters last at most **30 seconds**, and quiet gaps last at most **10 seconds**. A dense day extends beyond the requested length to stay readable. A sparse day shortens instead of making you stare at one project for minutes. The actual duration appears next to the slider.
- Pause/play, drag the scrubber, use previous/next, or click any project chapter. Seeking pauses so you can read. Changing the target duration preserves your chapter and approximate position.
- The character moves at normal animation speed while the recap moves through historical time. Clock labels and evidence show the recorded times. Each working chapter summarizes a burst of events, rather than replaying individual keystrokes or pretending to record exact presence.
- Quiet gaps longer than 75 minutes receive short gap chapters. They mean no fetched public signals; incomplete earlier coverage is shown as unavailable.
- Playback pauses when you hide the tab. Current polling stops during replay, and the historical dataset stays frozen. The pulse is recalculated at the displayed historical point. The shelf fills with projects already reached; it does not claim all of them were shipped.
- Historical testing is not inferred from current workflow runs. The replay uses public events only; it cannot reconstruct workflow history across all projects.
- **Try demo** while in replay switches to a fictional sample day with nine different project objects. Returning to GitHub restores public history.

Replay loads up to three 100-event pages, stopping when the rolling-day boundary is reached or the feed ends. GitHub caps the feed at 300 events. Saved public events collected by this browser during the last 24 hours are merged and deduplicated. Busy days or failed pagination can therefore have a partial recap; that is labeled above the player. Private work and delayed public events are still invisible. No full-day coverage is promised.

## Objects that match the project

The bench and shelf use 16 original SVG objects. Repository names are matched first, then descriptions, then topics. Exact per-repo mappings take priority. The UI states where the match came from. These are illustrations of the project type, not actual screenshots of its software.

| Repository clue | Illustration |
| --- | --- |
| wallet, payments | Wallet with money and a coin |
| bot, robot, agent | Small robot |
| dashboard, console, harness | Monitor with a control dashboard |
| txn, transaction, simulator | Coin moving between transaction machines |
| safe, vault, treasury | Safe with a wheel door |
| keypad, keyboard | Keypad |
| grove, garden, forest | Tiny grove |
| frog | Frog |
| bunker | Bunker |
| lessons, learning, chronicle | Open book |
| daily, morning, news | Newspaper |
| research, science | Microscope |
| liquidity, vesting | Liquid jar with a lock and clock |
| token, coin | Coin stack |
| crawler, spider | Spider web |
| Unclear | Labeled project blueprint |

For precise control, edit `visualOverrides` in `src/config.js`:

```js
visualOverrides: {
  'clawdbotatg/clawd-harness': { kind: 'dashboard', label: 'Agent control dashboard' },
  'clawdbotatg/my-project': { kind: 'wallet', label: 'My wallet project' },
},
```

Allowed kinds are listed in `src/objects.js`. The artwork lives in `public/objects.svg`. Unknown projects are not assigned a made-up object.

## What drives the states?

| State | Observed signal | Animation |
| --- | --- | --- |
| Building signals | Push or pull request within 45 minutes | Hammering, sparks, bobbing |
| Planning signals | Other supported activity within 45 minutes | Blueprint, thinking |
| Checks running | Latest repo has a running/queued workflow attributed to this builder | Goggles, blinking machine |
| Just released | Published release within 15 minutes | Package, confetti, happy bounce |
| Quiet signals | No recent public building signals | Closed eyes, floating Zs, lights dimmed |
| Awaiting signals | GitHub failed or the saved check is stale | Neutral character, lights dimmed |

States describe **public signals**, not actual current keystrokes. A quiet workshop does not mean the builder stopped working. A GitHub Actions workflow can run tests, build code, or do something else: the UI says **checks**, not a guaranteed testing stage. We never invent a percent complete or a current project.

Supported events: pushes, pull requests, PR reviews, branch/repo/tag creation, issues, issue comments, and releases. Stars and follows are excluded. The latest supported event determines the repository to check. Workflow attribution requires the run's actor or triggering actor to match the configured username. Only that repo's latest 20 workflow runs are checked; other concurrent projects can be missed.

The shelf lists up to three of the user's recently pushed public repositories. This is **not** proof they were shipped or completed. Published releases in the fetched event window are listed separately.

## Build Pulse

An intentionally playful activity heuristic, not a productivity or quality metric. Pushes add 16, PR events 22, PR reviews 8, create events 10, issues 5, issue comments 3, and release events 35. Each contribution decays exponentially with a 30-minute half-life. Score = `round(100 * (1 - exp(-weightedSum / 60)))`, capped at 100. Events more than 24 hours old and future events are excluded. The line recomputes that score at one-minute intervals over the last hour. Workflows don't add to this score.

## Data, limits, and failure behavior

- Requests go from the visitor's browser to `api.github.com`. No personal access token is embedded or requested.
- Current mode fetches the latest **100** public events; replay can load **300** plus locally observed events from the rolling day. The public event feed is limited and delayed; GitHub documents latency from **30 seconds to 6 hours**. This page does not claim true live presence.
- Refreshes every **five minutes while the tab is visible** and follows longer GitHub `X-Poll-Interval` advice. Event and workflow requests use ETags when exposed. Repository metadata is cached in memory for an hour.
- Normally about 25 requests per hour per open tab in current mode. Loading replay costs up to three event requests, with five-minute in-memory caching. Repository metadata for up to 100 repos is cached for an hour. GitHub's unauthenticated quota is **60 requests per hour per originating IP**; multiple tabs/visitors on one network share that quota. Rate-limit headers trigger backoff. Manual refresh is throttled to 15 seconds.
- Fetch timeout: 15 seconds per request. Failures show a message; the last successful snapshot is kept in localStorage when available, labeled saved. The current character becomes unknown after an event fetch failure or when the last check is too old. A workflow-specific failure still allows event-based inference, with a visible warning.
- Running workflow data from a snapshot more than two polling intervals old is never presented as current.
- No analytics, cookies, external fonts, or asset services. Browser localStorage holds the last successful public snapshot and locally collected public events from the last 24 hours; clearing site data removes them. If browser storage is full or disabled, saving is skipped and the in-memory app still works.
- API text is rendered with `textContent`; outbound event URLs are restricted to HTTPS GitHub links.

For a bigger public audience or actual live state, add a server-side cache / GitHub App and opt-in telemetry. Keep credentials on that server. This v0 intentionally stays static and easy to drop into GitHub.

## Customize

Edit `src/config.js` to change the username, display name, or timing. The character and workshop artwork are in `index.html`; colors and state animations are in `src/styles.css`. The mascot stays Clawd-shaped when tracking another account.

```text
index.html             Dashboard and scalable workshop artwork
src/app.js             Rendering, controls, cache, polling
src/activity.js        Event descriptions, status, pulse
src/github.js          GitHub client, ETags, rate-limit backoff
src/demo.js            Explicit fictional sample data
src/replay.js          Day chapters, pacing, merging, playback positions
src/objects.js         Project-to-object matching
src/config.js          Builder and timing configuration
src/styles.css         Responsive design and state animations
public/favicon.svg     Tiny Clawd icon
public/objects.svg     Sixteen scalable project props
scripts/dev-server.mjs Local development server (not a deployment entry point)
scripts/build.mjs      Static export
vercel.json            Explicit static deployment settings
tests/                 Node's built-in test suite
```

Official API references: [Public events and latency](https://docs.github.com/en/rest/activity/events), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs), [rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

The code is provided for you to edit and publish. Clawd's character identity remains associated with its creator; this project does not claim official affiliation.
