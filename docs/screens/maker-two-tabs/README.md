# The map maker in two tabs, and a double-click on Delete

The two ways the map maker bug hunt of 10 Nov 2026 lost a maker's work, before and after the fix.

- `before-second-tab-drafts.png` / `after-second-tab-drafts.png`: tab B's drafts list after tab A renamed its map to "Quarry Of A v2" and B then saved its own. Before, B's save put A's old "QUARRY OF A" back over the newer one (and A's save had already put B's map away). After, B lists A's latest name, and both maps are stored.
- `before-double-click.png` / `after-double-click.png`: the drafts list straight after a double-click on WEEK OF WORK's Delete. Before, the draft was gone. After, it waits on "SURE?", and only a press of its own deletes it.

Made by `tools/playtest/makerTwoTabs.mjs`, which plays both cases in two pages of one headless Chromium (`tools/playtest/browser.mjs`) at 1280x800 against `npm run dev` in test mode, and prints PASS or FAIL for each step:

```
node tools/playtest/makerTwoTabs.mjs http://localhost:<port>/ <shots-folder>
```

The "before" pictures are the same driver run with `src/game/scenes/MapMakerScene.ts` and `src/game/maker/drafts.ts` as they were on `main` at `5c21f3fd`.
