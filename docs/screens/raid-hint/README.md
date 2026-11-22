# The raid's hint line

What SPACE works on the tile faced, said along the foot of the screen as the
harbour says it (`WorldScene.hintHere()`, `ui/hintLine.ts`).

- `gate-faced-before.png` / `gate-faced.png`: standing on 286,105 facing down
  onto the Power Station's SERVICE GATE with a Card Key packed. Before, nothing
  said which tile the caption's gate answered SPACE from. The "before" is the
  same spot with the line hidden, a frame later (the townsfolk along the foot
  have moved on a step).
- `beside-the-gate.png`: 285,107 facing up, where the 20 Nov playtester pressed
  SPACE and nothing happened. No line here, because a press does nothing here.
- `cache-faced.png`: Millbrook's TOOL SHED faced from below.

Made in a real raid (dev server, `?testmode=1`, deployed through
`tools/playtest/deploy.mjs` with `stash: ['card-key:1'], pack: ['card-key:1']`),
the player stood on each tile as `tools/playtest/exitRides.mjs` stands one.
DOM and text draw the same in test mode.
