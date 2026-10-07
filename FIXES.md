# Quiet workshop fixes · October 7, 2026

Based on the user's latest supplied `ZeitgeistJones/clawd-workshop` Repomix snapshot, including the local MP3 radio and workshop chat.

- Removed the floating bench plaque, hover grades, full build brief/commit feed, score shelf, and score dialog. Removed the brief's extra repository detail requests. Props still open their repositories. A header link opens the Build Report.
- Recent activity and the activity pulse are collapsed by default. The workshop is wider at ordinary desktop widths; chat stacks underneath before the room becomes cramped. Wide monitors can keep chat alongside the stream.
- Music tries unmuted playback first. Enable music appears when the browser requires interaction. Track-load errors stay visible with Retry, and the animated radio reflects audible playback rather than a false live state. Volume has a percentage, persists when storage is available, and zero volume has a clear unmute path.
- Radio reuses its media element across tracks, handles asynchronous metadata/track changes, bounds load waits, and prevents stale starts from reviving stopped audio. It runs in background tabs and recovers from page cache restoration.
- Chat preserves reading position and offers New messages; only 80 messages remain rendered. ID cursors prevent missing simultaneous posts and messages arriving around your own send. Failed sends retain drafts; leaving clears the remembered nickname; stale responses cannot revive a previous session. Browser and Redis requests have timeouts, malformed values are rejected, and the post rate limit gets its expiry atomically.
- Removed misleading nickname/account wording and the unusable station selector. Added font MIME types and a chat body-size limit to local development.

`CURSOR.md` contains the exact merge prompt. No production repository was committed or site deployed in this update. Browser autoplay is controlled by the browser; a fresh visitor may still need one click. Live Redis, public market endpoints, and deployed share previews require verification in the existing deployment.
