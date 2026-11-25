# The front door after the critic's fourth pass

A fresh critic subagent scored the rebuilt first half-hour 8/10 ("the front door now
works. I would send a friend through it. Nothing left is structural") and named three
small faults. Each pair is the same moment of the same new save, before and after.

- `before-landing.png` / `after-landing.png` - the landing. A prize chip (₽10 / SE 7)
  stood beside CATCH THE PIDGEY, a second sum and a second heading nobody had explained.
  It is hidden while the catch is the job, and comes back once it is done.
- `before-after-the-catch.png` / `after-after-the-catch.png` - straight after the catch.
  The spare Pidgey (top left) stood up just as Oak was saying "get out". Now it stands up
  only for a retry, after a knockout or a run. The chip offers both ways until the player
  walks towards the money.
- `before-card.png` / `after-card.png` - the result card over a catch-only raid. Its note
  read "Everything above is on BILL'S PC, ready for your next raid.", naming a place a first
  raid has never heard of. Now: "PIDGEY is waiting at base for your next raid."

Made with `node tools/playtest/firstRaid.mjs <url>?testmode=pixels <out> --window=1200x768
--shots --catch` against two `VITE_EPTW_TEST_MODE=pixels npx vite build --base=/` builds
served with `vite preview`: before at `6b2b3573` (#855's head), after at this branch.
