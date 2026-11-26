# A sentence names a screen, not its key, on the touch pad

The raid's result told a thumb where its haul went with keyboard letters
there is no key for: "YOUR THINGS (B at base)", "YOUR TEAM (P at base)", and
"IN YOUR THINGS · B AT BASE" under the sack. A disc's line did the same,
"from YOUR THINGS (B) anywhere at base". While the pad is up, `touchWording`
(`src/game/input/touchWords.ts`) now drops such an aside when the letter is a
key that opens a screen by name (B, P, O, M, X), because the tray's button
is that screen's own name. The keyboard's words are unchanged.

- `before-result.png` - main, the result of a new save's first raid on a
  412x915 phone.
- `after-result.png` - this change, the same screen.

Made touch only on a test-mode build (`?testmode=pixels`) with the phone of
`tools/playtest/phone.mjs`; the raid was deployed by `deploy.mjs` and
everything after it was pressed on the pad.
