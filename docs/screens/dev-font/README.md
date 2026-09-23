# The game font under `npm run dev`

PR #166 made `src/style.css` name the font and the figure sheet relative to the
emitted stylesheet (`url('./battle/orange-kid.woff2')`). That lands next to the
built CSS on GitHub Pages, but the dev server serves the stylesheet from
`/src/`, so the font request came back as `index.html` and every DOM screen drew
in the browser's monospace. The fix is the root-absolute form
(`url('/assets/...')`), which the dev server serves as it is and the build
prefixes with `base`; `src/styleAssets.test.ts` asks Vite both ways.

- `before-dev-bill-1200x768.png` - Bill's quay under `npm run dev` on `main`: monospace.
- `after-dev-bill-1200x768.png` - the same screen with the fix: Orange Kid.
- `after-pages-build-bill-1200x768.png` - the production build served under
  `/escape-from-pallet-town-web/`, still Orange Kid.

Seen on the way: with the font back, Bill's shelf pane showed a red stub of the
next line under its MORE strip. `.shop-detail` had re-added the bottom padding
`.px-scroll` removes (the trap `.px-dossier` fell into before), and the strip
did not know the pane's lines. The foot is gone, `style.test.ts` holds every
scroll-pane class to it, and the fold is measured per line of wrapped copy.

- `interim-workshop-line-cut-640x480.png` - measuring a wrapped sentence by its
  glyph boxes put the fold three pixels into the line above.
- `after-workshop-640x480.png` - measured by line box: every line whole.
