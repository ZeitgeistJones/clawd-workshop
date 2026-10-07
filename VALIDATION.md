# Validation · quiet workshop update · October 7, 2026

This describes the supplied fixes, and supersedes historical instructions about the old generative radio, opt-in music, build brief, and score shelf.

- `npm test`: **57 passed**, zero failures.
- `npm run build`: passed. Local builds without `SITE_URL` emit the expected share-preview URL reminder; Vercel's existing production environment supplies the deployment URL.
- Real headless Chromium checked at **320, 390, 768, 860, 900, 1024, 1280, 1440, and 1920 px**. No horizontal page overflow. At 1440 px the scene is 1008 px wide, with chat below; wide monitors retain chat beside the room. Desktop and phone screenshots were visually inspected.
- Actual bundled MP3 media loaded and advanced `currentTime`, with `paused=false`, `muted=false`, and positive volume. Checked both permissive and interaction-required autoplay policies: automatic audible startup where allowed, and Enable music followed by audible playback where blocked. Verified mute/unmute and zero-volume recovery. This verifies media playback state, not physical speaker output.
- Chrome often blocks unmuted autoplay while Firefox allows it. On block, the shared loop may continue muted and the radio shows a clear Enable music action; unlock unmutes the existing media element inside the click gesture so Chrome keeps user activation.
- Removed plaque, build brief, grade popup, and score shelf are absent. Focus view opens, Escape closes it, and the same workshop returns to its original position.
- Browser chat used intercepted local fixture responses, not posts to the public room. Verified join, send, leave, no automatic rejoin after Leave/reload, scroll preservation while new posts arrive, New messages, retention of other pending posts around your own send, and the 80-message DOM cap. No uncaught page errors.
- Node coverage includes track transitions on the same audio element, stale starts after Stop, media error/retry, autoplay denial, same-millisecond ID cursors, aged-out history cursors, malformed chat values, atomic expiring rate limiting, plus existing GitHub, admin replay, prop matching, sharing, and market-decoder checks.

Not verified in this environment: physical speakers, Safari/iOS-specific autoplay rules, OS background suspension, a real browser back/forward-cache round trip, deployed Redis credentials, live DEX/RPC transactions, platform share embeds, or production deployment. The corresponding recovery paths are implemented; deployed services still need checking in the existing project.

No repository was committed, public messages sent, or Vercel deployment performed. `CURSOR.md` contains the merge prompt and deployed checks.
