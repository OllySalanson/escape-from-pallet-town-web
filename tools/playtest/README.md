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

`raid.mjs --exit=LABEL` (`--exit=ferry-dock`) leaves by a named exit rather than
the nearest one open from the first second: it stands beside the exit until its
caption reads `EXTRACT OPEN`, then steps on. A timed exit is never chosen
otherwise, so nothing else checks that one can be walked to.

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
