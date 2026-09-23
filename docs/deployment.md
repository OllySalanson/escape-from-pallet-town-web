# Deployment (GitHub Pages)

The game ships as a static Vite build on GitHub Pages.

## Public URL

After a merge to `main`, the live game is at:

**https://ollysalanson.github.io/escape-from-pallet-town-web/**

## How it is published

- `.github/workflows/pages.yml` runs on every push to `main` (and on manual dispatch).
- The workflow lint-checks, typechecks, tests, builds, uploads `dist/`, and deploys through the official Pages actions.
- Deployments are serialized (`concurrency.group: pages`) so two pushes do not race.
- Production builds set Vite `base` to `/escape-from-pallet-town-web/` in `vite.config.ts`; local dev and tests keep `/`.

## Verify locally before merging

Run the same gates CI uses:

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

1. Open the [Actions](https://github.com/OllySalanson/escape-from-pallet-town-web/actions/workflows/pages.yml) tab and confirm **Deploy GitHub Pages** succeeded on the merge commit.
2. Load the public URL above in a normal browser (not test mode).
3. Start a new game and walk one tile to confirm assets and save behaviour.

## Asset paths

Runtime and DOM asset URLs go through `publicAssetUrl()` in `src/game/publicAssetUrl.ts`. Bundled CSS references public files by root-absolute path (for example `url('/assets/battle/orange-kid.woff2')`): the dev server serves `public/` at `/`, and the production build rewrites the path to `/escape-from-pallet-town-web/assets/...`. Do not make these relative to the emitted stylesheet - that form happens to work in the build but resolves against `/src/` under `npm run dev`, where the dev server answers with `index.html` and every menu loses its font. `src/styleAssets.test.ts` checks every stylesheet URL against both a real dev server and a real build.
