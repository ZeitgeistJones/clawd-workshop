# Is Clawd building?

A complete, dependency-free web app for watching `clawdbotatg`'s public GitHub activity. A cute red triangular Clawd works in an animated SVG garage; the data changes his behavior. Warm paper colors, a workbench, a robot on the shelf, a kettle, a build pulse, and an evidence timeline. Responsive on desktop and phone.

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

## See every animation

Click **Try demo**, then choose Building, Planning, Testing, Shipping, or Quiet. The entire dashboard is labeled **DEMO · SAMPLE ACTIVITY**. Alternatively open `http://localhost:3000/?demo=1`. Demo does not fetch GitHub data. Returning to GitHub fetches real activity; failed requests never silently switch to demo.

Clawd is drawn in SVG and animated with CSS. He retains the reference character's red triangular face, sly eyes, mischievous smile, bow tie, and claws, with a little workshop apron. No raster assets are required. The pause button stops motion; reduced-motion preferences are respected.

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
- Fetches the latest **100** public events, not the user's entire history. The public event feed is limited and delayed; GitHub documents latency from **30 seconds to 6 hours**. This page does not claim true live presence.
- Refreshes every **five minutes while the tab is visible** and follows longer GitHub `X-Poll-Interval` advice. Event and workflow requests use ETags when exposed. Repository metadata is cached in memory for an hour.
- Normally about 25 requests per hour per open tab. GitHub's unauthenticated quota is **60 requests per hour per originating IP**; multiple tabs/visitors on one network share that quota. Rate-limit headers trigger backoff. Manual refresh is throttled to 15 seconds.
- Fetch timeout: 15 seconds per request. Failures show a message; the last successful snapshot is kept in localStorage when available, labeled saved. The current character becomes unknown after an event fetch failure or when the last check is too old. A workflow-specific failure still allows event-based inference, with a visible warning.
- Running workflow data from a snapshot more than two polling intervals old is never presented as current.
- No analytics, cookies, external fonts, or asset services. Browser localStorage holds the last successful public snapshot only; clearing site data removes it.
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
src/config.js          Builder and timing configuration
src/styles.css         Responsive design and state animations
public/favicon.svg     Tiny Clawd icon
scripts/dev-server.mjs Local development server (not a deployment entry point)
scripts/build.mjs      Static export
vercel.json            Explicit static deployment settings
tests/                 Node's built-in test suite
```

Official API references: [Public events and latency](https://docs.github.com/en/rest/activity/events), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs), [rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

The code is provided for you to edit and publish. Clawd's character identity remains associated with its creator; this project does not claim official affiliation.
