# Clawd Workshop visual refresh

## Engagement direction (in progress)

The illustrated studio stays. The next pass makes the room answer in the first screen, instead of reading like a brochure above the picture.

Touch Clawd and he glances over. The window is just the window. The board on the right wall chalks public pushes, merges, and releases. In chat, @clawd answers from the public repo on the bench. The fireplace opens the incinerator site.

This is a draft direction. Later notes here should say what actually shipped.

This is actual updated source, based on the Repomix snapshot you supplied.
The project remains a dependency-free static site that builds for Vercel.

## Give this to Cursor

Upload this ZIP, then paste:

> Apply the visual refresh in this ZIP to my existing Clawd Workshop repository.
> Use the supplied implementation and follow VISUAL-REFRESH.md. Merge the new
> index.html layout and SVG room, add src/studio.css and src/studio.js, and add
> `import './studio.js';` beside the lounge import in src/app.js. Copy the complete
> public/fonts directory, including its licenses. Preserve my current GitHub,
> replay, music, market, sharing, and Build Report logic and configuration.
> If my checkout has newer changes, merge these visual changes into it instead
> of replacing the whole checkout. Run npm test and npm run build. Then check
> the desktop and phone layout, focus view, all demo states, and admin replay.
> Summarize the final diff and validation results.

## Files to merge

| File | Change |
| --- | --- |
| `index.html` | Header, compact day summary, larger studio presentation, detailed original SVG room, project plaque, focus controls/dialog, clearer build details, sidebar order, and font/CSS links. Existing controller IDs are preserved. |
| `src/app.js` | One added import: `import './studio.js';`. All existing app logic stays in place. |
| `src/studio.css` | Visual overrides, responsive layouts, local font faces, focus view, and ambient dust animation. Loaded after the existing two stylesheets. |
| `src/studio.js` | Native-dialog focus view and a project plaque that follows the same public metadata and illustration mapping as the workbench. |
| `public/fonts/` | DM Sans, Lora, Lora Italic, both OFL licenses, and source notes. Fonts are served locally. |
| `VALIDATION.md` | Added validation notes for this refresh; earlier notes remain attributed to earlier work. |

The rest of the ZIP is the supplied source snapshot, plus the existing sharing
image and video fetched from the repository because Repomix omits binary files.
The audio composer, project-prop library, event classification, market thresholds,
share assets/metadata, and Vercel configuration have been preserved.

## Preview locally

Use Node 22 or newer. No package installation or new API key is needed.

```sh
npm run dev
```

- Open `http://localhost:3000/?demo=1` for clearly labeled sample activity.
- Use the state dropdown at the bottom to preview all five workshop moods.
- **Focus view** enlarges the same workshop. Escape or **Exit focus** closes it.
- Radio starts when you press Play. Your original generative music is retained.
- **Preview buy** and **Preview burn** show labeled sample reactions. Open
  **Workshop reactions** to set the demo burn amount; larger amounts grow the fire.
- Open `http://localhost:3000/?admin=1&demo=1` to check the sample-day replay.
- Open `http://localhost:3000/` to connect to the existing public data sources.

```sh
npm test
npm run build
```

Vercel continues to run `npm run build` and serve `dist/`. The existing
`SITE_URL`/Vercel domain handling still applies to sharing metadata. This package
has not been pushed to GitHub or deployed.

## What changed visually

- A warm illustrated studio with a dusk window, layered light, textured floor,
  woven rug, wood grain, record cabinet, framing, and a more dimensional Clawd.
- The cold fireplace still comes to life only for qualifying burn reactions.
- The stream keeps its project identity when enlarged. Props remain recognizable
  metaphors selected by the existing name/description/topic matching.
- Locally hosted display and UI typefaces, softer surfaces, restrained olive and
  terracotta accents, quieter statistics, and cleaner spacing.
- Repository descriptions and latest changes have separate columns on wide
  screens and stack on phones. Commit links, topic tags, and project links remain.
- Clearer recent-activity, project, radio, market, and Build Report cards.

## Validation and limits

48 existing Node tests passed, and the static build succeeded. Chromium browser
checks covered eight screen widths, all five states, focus containment and Escape,
dialog controls, replay, demo market reactions, opt-in Web Audio, reduced motion,
and a fresh offline visit. No JavaScript page errors appeared in these checks.

The visual checks used labeled demo data. Live market/provider access, production
social previews, and speaker-level listening still need a check after deployment.
No live transaction or current GitHub activity was invented for the preview.
