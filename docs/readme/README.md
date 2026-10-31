# The front page's pictures

Everything here is shown on the repository's front page ([README.md](../../README.md)), and all
of it is the game: screenshots of the real game, and two pieces of art put together from the
game's own parts. Nothing is drawn by hand, so all of it can be made again when the game changes.

GitHub shows a README in a column 838 pixels wide on a desktop, so every picture is made to be shown
800 wide: a game screen photographed at 800x512 is the stage at exactly 2x (`src/game/display/stage.ts`),
and one photographed at 1600x1024 (or 1600x1000) is shown at half size, which is still a whole
number of screen pixels to the game pixel and stays sharp on a high-density display too.

| File | What it is | Made by |
|---|---|---|
| `hero.svg` | The animated banner: Millbrook, in Greystone Vale, drifting by at dusk, the title plate, the raid clock gone red, and Blue chasing the player along the bottom | `tools/readme/drawArt.mjs` |
| `cast.png` | The four keepers of the base and the five rivals, off the sheets the game draws them from | `tools/readme/drawArt.mjs` |
| `social-preview.png` | The picture a link to the repository unfurls as (1280x640, the banner's parts at four to one so the title survives a thumbnail). Not shown on the page: GitHub has no API for it, so it is uploaded by hand under Settings, General, Social preview | `tools/readme/drawArt.mjs` |
| `walk.webp` | A walk out of Mill Square in Millbrook, fifteen frames a second of game time, a straight run at a time | `tools/playtest/readmeShots.mjs`, then ffmpeg |
| `quarry.png` | The Quarry in Greystone Peaks, a moment into a raid (1600x1024) | `readmeShots.mjs --part=place --insertion=greystone-vale-the-quarry --window=1600x1024` |
| `hunter.png`, `battle.png` | The hunters coming out in Millbrook, and a fight with Blue (1600x1024) | `readmeShots.mjs --window=1600x1024`; `battle.png` was taken with the one hunter a raid had before the pack, and `--battle` is what would ask for it again |
| `harbour.png` | The harbour with every one of Brock's upgrades built, by day (1600x1024) | `harbourTour.mjs --built=all --clock=day --window=1600x1024`, taken off the quay |
| `brocks-workshop.png` | Inside Brock's Workshop, every bay built (800x512) | `readmeShots.mjs --part=base --rooms=brocks-workshop` |
| `the-bench.png`, `the-rim.png` | Getting ready on the floor of the Raid Arena: the bench over the hall, and looking down from the rim (800x512) | `arenaHall.mjs --window=800x512`, its `3-bench.png`; `arenaTelescope.mjs --window=800x512`, its `rim-another-way-in.png` |
| `pack.png` | The pack opened mid-raid with a few finds put in the raid's own bag first: a crate, a roll of linen, a valve, a Super Potion, a Thunder Stone and ₽40 (800x512) | `readmeShots.mjs` |
| `map-maker.png` | The map maker with the sample map open at 1X (1600x1000) | `readmeShots.mjs --part=maker --window=1600x1000` |
| `extracted.png`, `raid-lost.png` | The two ways a raid ends (800x512) | `tools/playtest/raid.mjs --pixels --stepped --window=800x512 --shot=...` (both `--insertion=greystone-vale --seed=3 --level=12`: `--grab=mooring-rope,super-potion` walked out, `--grab=money,parts-crate,linen-roll,super-potion,mooring-rope` went down) |

## Making them again

Photograph a test-mode **build**, never the dev server (`tools/playtest/README.md`, 'Memory'):

```bash
SCRATCH=...            # somewhere of your own
VITE_EPTW_TEST_MODE=1 npx vite build --outDir "$SCRATCH/dist"
mkdir -p "$SCRATCH/root" && cp -r "$SCRATCH/dist" "$SCRATCH/root/escape-from-pallet-town-web"
python3 -m http.server "$PORT" --directory "$SCRATCH/root" &
export EPTW_CHROME_LIBS="$(tools/playtest/ensure-libs.sh "$SCRATCH/chrome-libs")"
URL="http://localhost:$PORT/escape-from-pallet-town-web/"

node tools/playtest/readmeShots.mjs "$URL" "$SCRATCH/shots"                        # 800x512, and the walk's frames
node tools/playtest/readmeShots.mjs "$URL" "$SCRATCH/big" --window=1600x1024
node tools/playtest/readmeShots.mjs "$URL" "$SCRATCH/big" --part=base --window=1600x1024
node tools/playtest/readmeShots.mjs "$URL" "$SCRATCH/shots" --part=base --rooms=brocks-workshop
node tools/playtest/readmeShots.mjs "$URL" "$SCRATCH/big" --part=maker --window=1600x1000
node tools/playtest/readmeShots.mjs "$URL" "$SCRATCH/big" --part=place --insertion=greystone-vale-the-quarry --window=1600x1024

# The walk, lossless, at the 15 frames a second it was photographed at.
ffmpeg -framerate 15 -i "$SCRATCH/shots/frames/%03d.png" -c:v libwebp_anim -lossless 1 \
  -compression_level 4 -loop 0 docs/readme/walk.webp

# The banner, the cast and the link preview, set by the game's own text (so it needs the build too).
npx vite-node tools/tileset/renderMap.mts -- greystone-vale "$SCRATCH/vale-band.png" 1 --crop=66,147,72,14
node tools/readme/drawArt.mjs "$SCRATCH/vale-band.png" "$URL"
```

Keep every file well under a megabyte; the walk is the heavy one (about 550KB), and is lossless
WebP because a GIF of the same frames is several times the size.
