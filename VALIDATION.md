# Validation · speech bubble and room links · October 8, 2026

Clawd's reply is a paper speech bubble with a tail, sitting on the upper-right wall so it stays off his face. On a 390px-wide layout the same bubble stays on the right and still clears the face button; a long answer is tall there and covers wall beside him. The wall photo opens https://clawd-meme-contest-nextjs.vercel.app/ and the room radio opens https://clawd-beat-shop.vercel.app/. Both hit the link in headless Chromium. The sidebar mute and volume controls were not rewired. This environment did not follow those links through to the other sites.

# Validation · @clawd model · October 8, 2026

Production `POST /api/ask` logged `gemini answer failed 404`. A new Gemini key cannot call `gemini-2.5-flash`. The ask route now calls `gemini-3.5-flash-lite`. This environment did not call the live key. The speech bubble clears 20 seconds after an answer. On the demo page it was still up at 18 seconds and gone by 21.

# Validation · fireplace and @clawd · October 8, 2026

The chalkboard, the walk to it, and the chalk stick are gone. Touching Clawd, @clawd, and the fireplace link remain.

- `npm test`: **70 passed**. `npm run build` passed. Local builds still warn that `SITE_URL` is unset.
- Headless Chromium on the demo page: the board, chalk stick, and board button are absent. Touching Clawd still makes him glance and say a short line. The fireplace link is `https://incinerator.clawdbotatg.eth.limo`. A 390px-wide layout was not rechecked after the board came out.
- `@clawd` on the demo page answers that it is a sample and does not call Gemini. The Gemini request path was tested with a fake model response. The real key was not called from this environment. It is available to Production and Preview. Preview chat storage is still production-only, so on a preview his reply shows in the room's speech bubble and is posted into public chat only when Redis is configured.
- Not checked here: a live Gemini reply on the deployed site, Redis delivery of his chat line, or the incinerator site loading after the click.

# Validation · quiet workshop update · October 7, 2026

This describes the supplied fixes, and supersedes historical instructions about the old generative radio, opt-in music, build brief, and score shelf.

- `npm test`: **57 passed**, zero failures.
- `npm run build`: passed. Local builds without `SITE_URL` emit the expected share-preview URL reminder; Vercel's existing production environment supplies the deployment URL.
- Real headless Chromium checked at **320, 390, 768, 860, 900, 1024, 1280, 1440, and 1920 px**. No horizontal page overflow. Chat sits beside the workshop from ~921 px up (YouTube/Twitch); stacks under the stream only when the dashboard goes single-column.
- Actual bundled MP3 media loaded and advanced `currentTime`, with `paused=false`, `muted=false`, and positive volume. Checked both permissive and interaction-required autoplay policies: automatic audible startup where allowed, and Enable music followed by audible playback where blocked. Verified mute/unmute and zero-volume recovery. This verifies media playback state, not physical speaker output.
- Chrome often blocks unmuted autoplay while Firefox allows it. On block, the shared loop may continue muted and the radio shows a clear Enable music action; unlock unmutes the existing media element inside the click gesture so Chrome keeps user activation.
- Removed plaque, build brief, grade popup, and score shelf are absent. Focus view opens, Escape closes it, and the same workshop returns to its original position.
- Browser chat used intercepted local fixture responses, not posts to the public room. Verified join, send, leave, no automatic rejoin after Leave/reload, scroll preservation while new posts arrive, New messages, retention of other pending posts around your own send, and the 80-message DOM cap. No uncaught page errors.
- Node coverage includes track transitions on the same audio element, stale starts after Stop, media error/retry, autoplay denial, same-millisecond ID cursors, aged-out history cursors, malformed chat values, atomic expiring rate limiting, plus existing GitHub, admin replay, prop matching, sharing, and market-decoder checks.

Not verified in this environment: physical speakers, Safari/iOS-specific autoplay rules, OS background suspension, a real browser back/forward-cache round trip, deployed Redis credentials, live DEX/RPC transactions, platform share embeds, or production deployment. The corresponding recovery paths are implemented; deployed services still need checking in the existing project.

No repository was committed, public messages sent, or Vercel deployment performed. `CURSOR.md` contains the merge prompt and deployed checks.
