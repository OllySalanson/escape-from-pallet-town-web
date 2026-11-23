# The first load on a slow line

Both pictures are the page 30 seconds into its first load on a 1 Mbit/s line
with 300 ms latency and the cache off, at 960x600, in the machine's headless
Chromium (`fm-browser.sh`) against a test-mode build served without gzip:

    node tools/playtest/slowLoad.mjs <cdp port> http://127.0.0.1:<port>/escape-from-pallet-town-web/ <dir> 1000 300

- `before-30s.png`: main at 4fe41b69. The stylesheet is in after a few seconds
  and draws the empty frame; the game's script (4.4 MB, 1.2 MB gzipped) is
  still on its way, so the frame stood empty for about 55 seconds here until
  the boot scene's progress bar appeared. On GitHub Pages, which gzips, the
  same line leaves it empty for about ten.
- `after-30s.png`: the same moment with `index.html`'s loading line, which is
  there from the first paint and swept away when the game mounts
  (`gameLifecycle.ts`), so the boot bar takes over from it.
