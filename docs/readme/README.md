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
| `hero.svg` | The animated banner: Viridian City drifting by at dusk, the title plate, the raid clock gone red, and Blue chasing the player along the bottom | `tools/readme/drawArt.mjs` |
| `cast.png` | The four keepers of the base and the five rivals, off the sheets the game draws them from | `tools/readme/drawArt.mjs` |
| `walk.webp` | A walk from the Pokemon Center up Main Street, fifteen frames a second of game time, ending where a townsperson steps into the lane | `tools/playtest/readmeShots.mjs`, then ffmpeg |
| `raid.png`, `hunter.png`, `battle.png` | A raid in Viridian City, Blue arriving, and the fight he starts (1600x1024) | `readmeShots.mjs --window=1600x1024` |
| `harbour.png` | The base with every one of Brock's upgrades built (1600x1024) | `readmeShots.mjs --part=base --window=1600x1024` |
| `brocks-workshop.png` | Inside Brock's Workshop, every bay built (800x512) | `readmeShots.mjs --part=base --rooms=brocks-workshop` |
| `loadout.png`, `pack.png` | Kitting up in Oak's Lab, and the pack opened mid-raid with a few finds put in the raid's own bag first: a crate, a roll of linen, a valve, a Super Potion, a Thunder Stone and ₽40 (800x512) | `readmeShots.mjs` |
| `map-maker.png` | The map maker with the sample map open at 1X (1600x1000) | `readmeShots.mjs --part=maker --window=1600x1000` |
| `extracted.png`, `raid-lost.png` | The two ways a raid ends (800x512) | `tools/playtest/raid.mjs --pixels --stepped --window=800x512 --shot=...` (`--seed=3 --level=12` walked out; `--seed=7` went down) |

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

# The walk, lossless, at the 15 frames a second it was photographed at.
ffmpeg -framerate 15 -i "$SCRATCH/shots/frames/%03d.png" -c:v libwebp_anim -lossless 1 \
  -compression_level 4 -loop 0 docs/readme/walk.webp

# The banner and the cast, set by the game's own text (so it needs the build too).
npx vite-node tools/tileset/renderMap.mts -- viridian-city "$SCRATCH/viridian-city.png" 1
node tools/readme/drawArt.mjs "$SCRATCH/viridian-city.png" "$URL"
```

Keep every file well under a megabyte; the walk is the heavy one (about 550KB), and is lossless
WebP because a GIF of the same frames is several times the size.
