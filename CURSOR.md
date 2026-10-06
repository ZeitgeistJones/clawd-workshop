# Open this project in Cursor

The app is already implemented. Open the source folder and use Cursor to run, check, and improve it.

## Quick setup

1. Unzip `clawd-workshop-github-ready.zip` on your computer.
2. In Cursor, choose **File → Open Folder** and select `clawd-workshop`, the folder containing `package.json`, `index.html`, and this guide. Open the extracted folder, not the ZIP or its parent.
3. Open Cursor's terminal. Run `node --version`. This project requires Node.js **22 or later**. Install Node.js if that command is unavailable, then reopen the terminal.
4. Run:

   ```sh
   npm run dev
   ```

5. Open **http://localhost:3000** in your browser. No dependency installation or API key is needed.
6. Use **Try demo** to check all character states, and **Replay 24 hours** to try the day recap. For an offline-friendly start, open **http://localhost:3000/?demo=1**; the sample data needs no GitHub connection.

Stop the local server with **Ctrl+C** in its terminal.

## Paste this into Cursor Agent

```text
Read AGENTS.md, CURSOR.md, README.md, and VALIDATION.md first.

This is an existing Clawd Workshop app, not a blank project. Help me run it locally and check it thoroughly. Keep the current vanilla JavaScript, CSS, and SVG architecture and its Vercel static deployment.

Start with npm test and npm run build, then run npm run dev. Inspect the actual UI in a browser if your tools allow it. Verify desktop and phone layouts, real GitHub fetches, external SVG objects, and all demo animations. The earlier environment could not perform full browser testing, so this is the main outstanding check.

Check the 24-hour replay: five-minute target, two/eight-minute options, minimum seven seconds per chapter, short quiet gaps, grouped project updates, pause/play, scrub, previous/next, chapter selection, duration changes, completion/restart, and pausing when the tab is hidden. Make sure replay never uses current workflow runs as historical evidence or reveals future projects on the replay shelf. Missing feed coverage must be labeled.

Check that Clawd works on an object matching the project's repo name, description, topics, or explicit visual override. Wallet projects should look like wallets; robots like robots; safes like safes; dashboards like dashboards. Keep the cute red triangular face, sly eyes, claws, bow tie, and warm workshop style. Unknown projects must use a labeled blueprint rather than an invented match. Use src/config.js visualOverrides for precise repo mappings.

Keep browser fetch bound to globalThis to prevent Illegal invocation. Keep vercel.json framework null, build command npm run build, and output dist. Keep the local server under scripts/dev-server.mjs; do not restore a root server.mjs or a start script. Do not introduce a framework or backend for routine fixes.

Fix issues you find and run the relevant checks again after changes. Report what you changed, what you tested, and any remaining limitations. Don't claim browser validation or successful deployment unless you actually verified it.
```

## Know where to edit

| Change | File |
| --- | --- |
| Builder username, pacing defaults, precise project objects | `src/config.js` |
| Object matching | `src/objects.js` |
| Object drawings | `public/objects.svg` |
| Replay grouping, pacing, time positions | `src/replay.js` |
| Controls and page rendering | `src/app.js` |
| GitHub fetching and history pagination | `src/github.js` |
| Character/workshop artwork | `index.html` |
| Colors, layout, animation | `src/styles.css` |
| Vercel static deployment | `vercel.json` |

`AGENTS.md` gives Cursor the project context. The short `.cursor/rules/workshop.mdc` rule points it to those notes.

## Send Cursor changes to your existing GitHub/Vercel project

The downloaded ZIP is not automatically connected to your GitHub repo. If you want Cursor to push changes directly, clone your existing repository into Cursor first, then copy this archive's files into that checkout, replacing matching files and including the `src/`, `public/`, and `.cursor/` folders. Open that checkout as your workspace. Preserve its existing `.git` folder. Delete the old root `server.mjs` if it is still present.

Alternatively, edit the extracted folder in Cursor and upload the changed files to GitHub afterward.

Run `npm test` and `npm run build` before committing. Use your existing Vercel connection to deploy the commit; keep **Framework Preset: Other**, build **npm run build**, output **dist**, and the root directory containing `package.json`. `dist/` is generated output, so do not hand-edit it.

## Add-on: sharing previews

Use the updated archive's sharing assets and scripts. Merge `scripts/share-metadata.mjs` and the updated build, development server, and root HTML. Include `public/share-preview.png`, `public/workshop-preview.mp4`, both pages under `public/share/`, and `tests/share.test.mjs`. Preserve `src/` changes you already made.

Set `SITE_URL` to the real public HTTPS website URL when needed; otherwise Vercel's enabled system environment variables supply its production domain. Run the build, inspect its HTML for absolute HTTPS image and player URLs, and verify those assets are publicly accessible after deployment. Main link = image preview. `/public/share/index.html` = optional video card. Preserve the labeled demo clip and image fallback; don't promise autoplay or platform acceptance. Read README.md for deployment and caching details.

## Lounge redesign: merge and verification instructions

This archive is the source maintained in the original chat. Your Cursor checkout may have newer edits, including the title or custom shelf illustrations shown in the screenshot. Integrate this update; do not replace the checkout blindly or delete unrelated work.

Read AGENTS.md and README.md. Merge the larger workshop layout and new build-brief, market, and radio markup from index.html. Include src/lounge.css, src/lounge.js, src/builds.js, src/music.js, and src/market.js. Merge the lounge import and workshop:render event into src/app.js, descriptions/six projects on the shelf, GithubClient.details in src/github.js, and CONFIG.market defaults in src/config.js. Preserve replay, sharing metadata, the bound fetch fix, and static Vercel configuration.

Run npm test and npm run build, then check the app in a real desktop browser and at 390px width. Check SVG props, radio illustration, scene/brief proportions, text legibility, overflow, project descriptions, actual commit links, replay, music play/pause/volume/station changes, and both demo market reactions. Listen to the music rather than only checking that the button changes. Verify that no music starts before a click and that it stops when the tab is hidden.

For real market data, inspect DEX Screener and Base RPC requests from the browser. Check the token contract, chain ID, token decimals, selected pool, V3 currency verification, and V4 pool-id filter/sign convention. Confirm reactions against real transaction evidence. No reactions should come from ordinary transfers, price changes, cached events, historical replay, or stale USD quotes. If the public endpoint fails, report it and configure a suitable browser-accessible public endpoint; do not expose secret credentials or pretend demo data is live. Keep zero-address burns and dead-address transfers distinct.

The original environment could not open its local app in the preview browser, and real market HTTP requests returned 403. Node tests cover decoders, watcher retry/deduplication, demo isolation, replay suppression, and opt-in audio controls; they do not prove browser playback, live connectivity, or final layout. Report the real browser/deployment verification honestly.
