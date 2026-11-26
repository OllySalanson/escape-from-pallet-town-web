# Turning a phone upright keeps the game on it

A phone turned from its side to upright still holds the landscape layout when
the browser says the window changed: the pad's right-hand column stands 900
pixels across a 412-wide screen. A mobile browser widens its layout viewport
to take that in, so `innerWidth` and `innerHeight` read 641 and 1424, and the
game was laid out for that window - wider than the phone, with the touch pad
placed below the bottom of the screen and nothing left to bring it back.

The game now reads the window from the root element's client box
(`src/game/display/viewport.ts`), which is the screen whatever the page holds.

- `before-turned-upright.png` - main, a 412x915 Android at 2.625 turned from
  landscape back to portrait in the Raid Arena: no pad, no sound or feedback
  buttons, the game running off both sides.
- `after-turned-upright.png` - this change, the same turn on the title: the
  game fits and the pad is where it was.

Made with a touch-only session against a test-mode build
(`?testmode=pixels`), the device switched with `emulateDevice` from
`tools/playtest/phone.mjs` (landscape, portrait, landscape, portrait).
