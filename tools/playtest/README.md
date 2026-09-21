# Driving the real game in a headless browser

One browser per verification session, on a port nobody else can be on, running
the game in test mode, closed when the checks are done. `browser.mjs` is that
recipe with no dependencies; `raid.mjs` is a whole raid played through it.

```bash
export EPTW_CHROME_LIBS="$(tools/playtest/ensure-libs.sh "$SCRATCH/chrome-libs")"
npm run dev -- --port "$FREE_PORT" --strictPort &      # stop it when the session ends
nice -n 15 node tools/playtest/raid.mjs "http://localhost:$FREE_PORT/" --stepped
```

`launchBrowser()` passes `--remote-debugging-port=0`, so the OS picks the CDP
port and two workers cannot share one - a fixed port is how a driver once
attached to another worker's tab. `browser.close()` kills the whole process
group; call it in a `finally`.

## Test mode

| URL | renderer | loop | for |
|---|---|---|---|
| (plain) | WebGL | display, 60fps | the one real-speed check before reporting done |
| `?testmode=1` | Canvas | timer, 10fps | every logic check |
| `?testmode=pixels` | WebGL | timer, 10fps | a screenshot that will be judged by eye |

Canvas is the cheap one because a headless browser here has no GPU and runs
WebGL in software. It is not for screenshots: Phaser's Canvas renderer draws no
tints, and this game's water, trees and tall grass are tints, so a `?testmode=1`
frame of the Floodplain shows a lawn where the river is. The rules of the game
are identical in all three - see the numbers below.

In either test mode `window.__escapeFromPalletTownGame__` gains:

- `pauseLoop()` - stop the loop; every scene keeps its state.
- `stepFrames(n, frameMs = 100)` - run `n` frames synchronously on a paused loop.
  Game time moves only by what is stepped, so a check is deterministic and runs
  as fast as the machine can step it rather than in real time.
- `resumeLoop()` - hand the loop back to the clock; the pause is not charged.
- `loopPaused`.

A key event sent before `stepFrames` is processed by the first frame stepped. A
press that is down and up again inside one frame still counts, for every key the
game polls (`src/game/input/KeyPresses.ts`); it used not to, at any frame rate -
movement read `isDown`, and Phaser clears `JustDown` on key up. `raid.mjs --taps`
plays the whole raid on such presses.

Enter works a focused DOM control, so a driver can play the lobby's screens the
way a player does rather than calling `.click()`: `keyDescription` gives Enter a
`text`, which is what makes Chromium run a key's default action.

`raid.mjs --exit=LABEL` (`--exit=ferry-dock`) leaves by a named exit rather than
the nearest one open from the first second: it stands beside the exit until its
caption reads `EXTRACT OPEN`, then steps on. A timed exit is never chosen
otherwise, so nothing else checks that one can be walked to.

Battle HP numbers, HP bars and the sprite entrance are wall-clock tweens, so in a
stepped check they lag the state badly (a plate read `16/16` for three turns of a
Pokemon going 16 to 1) and the sprites sit half out of frame. Assert on
`getScene('battle').state`, never on `playerHpText` or a sprite's position, and
judge either by eye only at real speed.

## The base is a map, so a screen is walked to

The lobby is a town (`src/game/scenes/BaseScene.ts`), so nothing here clicks a
`button[data-view=...]` any more. `walkIntoBase(page, doorId)` in `deploy.mjs`
is how every driver reaches a base screen: it reads the scene's own collision
and its own `doors` list, paths to the doorway (or to beside the keeper, for
the quay, which has no door) and goes in. A redrawn base moves the walk with
it, which a table of tiles copied in here would not.

    await walkIntoBase(page, 'pokemon-centre');   // oaks-lab | brocks-workshop | the-quay

A raid ends back on the base's quay, not on a screen, so a driver that plays
two raids walks into Oak's Lab between them - `raid.mjs` does.

## Any map, any ending

A fresh save is offered one insertion, the Floodplain's front door. `deploy.mjs`
is the way in for every driver (`raid.mjs`, `tour.mjs`, `gridtour.mjs`, `whyHidden.mjs`),
and it goes the way a player does: the game writes its own save, `raidProgress`
is edited in it, the page is reloaded and the raid is deployed from the base
that save opens on - walking into Oak's Lab and clicking the insertion's own
row in the loadout.

- `--insertion=id` - `town-square`, `route-1`, `route-1-overlook`,
  `viridian-forest`, or a Floodplain drop-in. The save says the first contract
  is banked (which is what unlocks the other maps' front doors) and that the
  insertion has been stood on (which is what unlocks a drop-in).
- `--beaten=bossId,..` - those bosses are gone and their gates stand open:
  `--insertion=route-1-overlook --beaten=overlook-warden`.
- `--opened=gateId,..` - field-move doors already worked open, the other half of
  a save's door state (`world/gates.ts`): `--opened=forest-coppice-ride` deploys
  into a wood somebody has already cut, with a party that could not have cut it.
- `--stash=itemId[:n],..` - puts something in the vault. It is the only way to
  pack anything a fresh save does not own - an HM off Bill's table, say,
  which is the key to a field-move door - because `--pack` can only reach what
  the loadout is offering.
- `--completed=contractId,..` - those contracts are banked, so the board deals
  the next one: `--completed=survey-the-braid` puts the cordon ledger on Pallet
  Town and the warden's resupply on Viridian Forest.
- `--hp=N` - the team came home with no more than N HP each.
- `--level=N` - the team is at level N, with the moves that level knows. A boss
  is a fight a fresh starter cannot win (`tools/trainers/report.mts` prints how
  unwinnable), so this is how a driver gets to what is behind one:
  `--insertion=town-square --level=20 --fight`.
- `--team=speciesId:level,..` - more Pokemon in the vault beside the starter, and
  every one of them added to the raid party. Nothing else here deploys with two,
  and a double battle needs two: the engine refuses the second slot when the
  player has nobody for it, so a driver with one Pokemon plays WARDEN HOLT as a
  single battle and never sees the thing it was sent to look at.
- `--starter=Charmander` - which of the picker's three cards is taken. Anything
  measured per starter needs it; the default is Bulbasaur.
- `--stash=itemId[:n],..` - a player who has banked supplies, written into the
  save's vault before the lobby opens. The loadout's stepper cannot pack more
  than the vault holds, so this is what makes a pack filled to its **last
  square** reachable - which is the only state the pack-full refusals happen in.
- `--pack=itemId[:n],..` - puts supplies in the raid bag by the loadout row's own
  stepper. **Nothing is packed by default** - the flow starts the pack empty,
  because the loadout is the decision the game is built around - so a driver that
  clicks through deploys with no medicine, and a fight priced in Potions (the
  Floodplain checkpoint) cannot be played without this.
- `--secure=itemId[:n],..` - takes the secure-slot detour on the way out and
  puts `n` (default one) squares of each kind into the container, by the row's
  own stepper. It is the only way the container is checked end to end, and the
  only way at all for a kind that is *found* rather than packed - a material, a
  note of scrip - whose row is room reserved for something not held yet. The
  container fills itself with the party's best Pokemon now, and a first-stage
  one takes all four squares a save starts with, so this first takes the
  Pokemon back out - which is the choice a player asking for gear makes too.

`raid.mjs` has four more. `--read=itemId` reads a disc in the raid's own bag -
the only place a machine is ever used - to the first party Pokemon FireRed lets
read it, answering the move chooser by giving up the first move where the
moveset is full. `--open=LABEL` works a **field-move door** (`--open=coppice-ride`,
`--open=shoal-crossing`): it walks to a tile beside the door, turns into it and
presses the interact key, and prints what the door said and whether the save
recorded it. Both run before the waypoints, because a disc and a door are
preparation for the walk rather than part of it - `--read=hm01-cut --open=coppice-ride
--work=coppicer` is the whole of a field move, played. `--work=LABEL` (`--work=sluice-wheel`) works a landmark
before leaving - stood on where it is ground, faced and worked with the interact
key where it is not - which is the only way an exit a landmark opens is ever
left by: `--insertion=town-square --work=sluice-wheel --exit=west-culvert`.
`--via=x:y,x:y` walks through those tiles first, in order, for a walk that is not
to anything - the way along a reveal, which an exit once stood in.
`--grab=itemId,..` walks to every piece of that item **this** raid laid, read off
the run plan: a map's authored loot position is only a fallback, so nothing else
can send a driver to a thing on the ground.
`--fight` stays in every fight instead of running from the wild ones.

`raid.mjs --arrange` lays the pack out by hand in the middle of the raid - the
cursor on a block, ENTER to take it, the arrow keys to carry it, ENTER to put it
down - and prints what the save was left holding when the raid ended. It is the
only thing that plays the whole promise a laid-out pack makes: arranged in the
field, carried through every fight, and still that way next time.
`packArrange.mjs <url> <out dir> [--plain]` is the other end of it, at base:
the loadout's pack and the secure container arranged by keyboard *and* by
pointer drag, turned with R, carried into a raid and read back there. Both are
how the captain's case of 2026-09-20 is walked rather than reasoned about.

`packFull.mjs <url> <out dir>` is the pack filled to its last square and walked
into each refusal that fullness causes: the catch a fight has to make room for
(`--drop`, the default, or `--keep`), the ground loot that will not go in
(`--loot`) and the gift the giver holds on to (`--gift`). `--potions=` and
`--balls=` are what fills the pack, `--plain` is the real-speed pass on a plain
URL. It is the only driver that reaches any of them, because a full pack needs a
vault that could fill it (`--stash`) and then a wild fight to be standing in.

Nobody chooses the other two endings, so they are reached sideways. The clock
runs out on a driver sent to an exit that will not open - `--exit=west-culvert`
with no `--work` stands beside it for the whole five minutes (stepped, that is
ten seconds). The last Pokemon is lost by `--hp=1 --fight`. Either way the
driver reads the defeat's beats through, waits for the report, and goes back to
base, so every run ends on the lobby it would start the next raid from.

Three things to know before believing a run. **The hunter only moves when the
player does** - it takes `aggressionStepsPerPlayerStep` of a step for every step
the player takes, spent in `WorldScene.advanceStep` - so a driver that stands
still to be caught will never be caught, and will report a hunter that closes to
three tiles and stops. A landmark is worked by walking over
it, so an exit is only sealed for a driver whose road does not cross its
landmark: check that the road a driver takes does not cross the landmark before
believing it met the exit sealed. And the dev server reloads the page whenever anyone saves a
file under `src/`, which takes the raid with it - `raid.mjs` says so rather than
failing somewhere odd. With another worker editing, play the real-speed pass
against a snapshot: `npx vite build --outDir "$SCRATCH/dist"` (no
`VITE_EPTW_TEST_MODE`: that build is in test mode at every URL) and
`npx vite preview --outDir "$SCRATCH/dist" --port "$FREE_PORT" --strictPort`.

`menuShots.mjs <url> <dir> [--window=1920x950] [--raid] [--resize] [--scrollbars]`
photographs every DOM screen at a real window size and prints, per scrolling
pane, how many rows it holds and how many of them a player can actually see -
the number the menus-against-the-window change (`src/game/display/menuStage.ts`)
is judged by. It fails the run on a row cut through its waist, anything drawn
outside its screen, a scrollbar down the side of the browser, a game pixel that
is not a whole number of screen pixels, a screen standing on half of one, or a
picture drawn at anything but a whole multiple of its own size. What escaped is
named with the first of its text, because a class name alone never said which of
five `SPAN`s it was. `--raid` adds
the three screens only reachable inside a raid, `--resize` drags one screen
through every window size without reloading, and `--scrollbars` gives Chromium
its scrollbars back so a pane's own track can be seen.

`shopScreens.mjs <url> <dir> [--window=1600x900]` stands in front of a rung you
can afford, one you cannot and one behind a door, and asks the screen the four
questions a player asks before spending: what is it, what does it cost, what do
I hold, and what is stopping me. It walks the cursor with the **arrow keys**,
because the pane under the list has to follow the cursor and not the mouse, and
it does the same at Bill's shelf and his barter table. It fails a row
that says only one of those four, a price in the pane whose asks do not line up,
anything drawn off the screen, and a barter whose *first* press spends the goods
- which is the one promise of that screen a screenshot cannot show.

`worldAnchors.mjs <url> [--window=WxH]` prints the canvas box, the stage, the
dialogue box and every caption the world has on screen, so the one thing the two
boxes must never change - where anything anchored to a tile sits - is diffed
rather than eyeballed.

`dropinShots.mjs <url> <dir> [--small] [--survey=path.json]` photographs the
drop-in step at both stages, on a fresh save and on one that has walked a third
of the Floodplain and beaten two of its keepers - the pair that shows the dark
pulling back. It refuses to photograph a screen that puts a scrollbar down the
side of the browser. The survey it draws is a real one: `raid.mjs
--progress=path.json` writes what a raid left in the record at base, survey
included, and `tools/tileset/minimap.mts --survey=` draws the same picture big
enough to criticise without a browser.

## The stranger's memory test

Whether a map reads as places is not something its author can judge: they know
where everything is. `gridtour.mjs <url> <out dir> --insertion=id` tiles a map
with playable-view frames knowing nothing about it, and the frames go - once
each, in order - to someone who has read nothing else: a fresh agent told to
open no other file and to draw the map from memory afterwards. Compare the
sketch with `tools/tileset/renderMap.mts`. What comes back placed is what holds
an object of its own; what comes back as "the same as everywhere else" is a
name plate over nothing. `whyHidden.mjs` answers the other half - a thing the
stranger saw and could not name.

## Idle costs the machine, so do not idle live

- Thinking or editing with a game page open: `pauseLoop()` (or never resume -
  drive the whole check with `stepFrames`).
- `page.freeze()` / `page.thaw()` stop a page outright and keep its state, but
  only on a **built** game: Vite's dev client reloads a page whose socket went
  quiet, so a frozen dev page thaws as a fresh load. `freeze()` refuses there.
  A build is `VITE_EPTW_TEST_MODE=1 npx vite build --outDir "$SCRATCH/dist"` then
  `npx vite preview --outDir "$SCRATCH/dist" --port "$FREE_PORT"`.
- Logic checks run in `LOGIC_WINDOW` (400x256, 1x zoom); `PIXEL_WINDOW` is 3x
  and nine times the pixels, for screenshots only.
- Close the browser and stop the dev server when the session ends.

## Measured

The same raid (`--seed=7`: Floodplain Relay, the first contract, two wild fights
run from, out by the South Gate, 52 tiles) on a 12-core WSL2 box with no GPU,
CPU summed over the browser's whole process group from the step into the world
to the result screen:

| mode | window | CPU seconds | wall seconds |
|---|---|---|---|
| plain (WebGL, 60fps) | 3x | 51.4 | 18.2 |
| plain (WebGL, 60fps) | 1x | 40.0 | 17.3 |
| `?testmode=pixels` | 1x | 9.5 | 19.6 |
| `?testmode=pixels`, stepped | 3x | 8.3 | 2.2 |
| `?testmode=1` | 3x | 3.6 | 19.9 |
| `?testmode=1` | 1x | 2.9 | 20.0 |
| `?testmode=1`, stepped | 1x | 1.2 | 1.2 |

Every row played the same raid to the same result screen: the same two
encounters at the same escape odds, the same loot, and 0:11 to 0:13 on the raid
clock - the spread is how long each driver run left a dialogue box open, not the
mode. Stood still in stepped mode at 100ms and at 16.7ms frames, the hunter
arrives on its planned 57.9s and the raid expires at exactly 300,000ms in both. Idle, a title screen costs 5.8 CPU-seconds per 5s plain, 0.27 in test
mode, and 0.02 frozen.
