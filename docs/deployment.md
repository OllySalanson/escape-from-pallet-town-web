# Deployment (GitHub Pages)

The game ships as a static Vite build on GitHub Pages.

## Public URL

After a merge to `main`, the live game is at:

**https://ollysalanson.github.io/escape-from-pallet-town-web/**

## How it is published

- `.github/workflows/ci.yml` runs every check on each commit to `main`. When it passes, `publish-after-ci.yml` starts `pages.yml`.
- `pages.yml` tests nothing again: it finds the newest commit on `main` that passed CI, checks that commit out, builds it, uploads `dist/`, and deploys through the official Pages actions. A commit whose CI failed is never published; the game stays on the last pass until a newer commit passes.
- Starting **Deploy GitHub Pages** by hand does the same thing, so it publishes the newest pass rather than the tip of `main` if the tip has not passed yet.
- Deployments are serialized (`concurrency.group: pages`). A newer publish may replace a waiting one and loses nothing, because the commit is chosen when a run starts, so the survivor publishes everything that has passed. CI runs finishing out of order cannot put the live game back.
- `publish-after-ci.yml` is separate so that a failed CI run, which also fires `workflow_run`, never joins that queue and pushes out a waiting publish.
- A map published by `publish-player-maps.yml` merges with the workflow's own token, which starts no workflow, so that job starts CI on the merge by hand and the usual path deploys it.
- Production builds set Vite `base` to `/escape-from-pallet-town-web/` in `vite.config.ts`; local dev and tests keep `/`.

## Verify before merging

`.github/workflows/ci.yml` runs every gate on each pull request to `main` and on `main`; its `ci-passed` job is the one that says a pull request may merge. To run the same gates by hand:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

Serve the production bundle under the Pages subpath. GitHub Pages serves the repo root at `/escape-from-pallet-town-web/`, so mirror that locally:

```bash
npm run build
rm -rf /tmp/eptw-pages-root
mkdir -p /tmp/eptw-pages-root/escape-from-pallet-town-web
cp -r dist/* /tmp/eptw-pages-root/escape-from-pallet-town-web/
npx serve /tmp/eptw-pages-root -l 4173
```

Open **http://127.0.0.1:4173/escape-from-pallet-town-web/** (note the trailing slash).

With the project's playtest driver:

```bash
node tools/playtest/pagesSmoke.mjs
```

Check the browser console and network tab for 404s on JS, CSS, fonts, sprites, or tile sheets.

## Verify after merge

1. Open the [Actions](https://github.com/OllySalanson/escape-from-pallet-town-web/actions/workflows/pages.yml) tab and confirm **CI** passed on the merge commit and the **Deploy GitHub Pages** run after it succeeded, publishing that commit (its first job names it).
2. Load the public URL above in a normal browser (not test mode).
3. Start a new game and walk one tile to confirm assets and save behaviour.

## Asset paths

Runtime and DOM asset URLs go through `publicAssetUrl()` in `src/game/publicAssetUrl.ts`. Bundled CSS references public files by root-absolute path (for example `url('/assets/battle/orange-kid.woff2')`): the dev server serves `public/` at `/`, and the production build rewrites the path to `/escape-from-pallet-town-web/assets/...`. Do not make these relative to the emitted stylesheet - that form happens to work in the build but resolves against `/src/` under `npm run dev`, where the dev server answers with `index.html` and every menu loses its font. `src/styleAssets.test.ts` checks every stylesheet URL against both a real dev server and a real build.
