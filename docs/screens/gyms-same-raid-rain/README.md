# Koga after Misty in the same raid, the Gym Guides, and the Coast's rain

Two findings of the gyms playtest of 14 Nov 2026, fixed.

**Koga after Misty, same raid.** Before: Misty beaten, Fuchsia Gym's head was empty and its Gym Guide told the new CASCADE BADGE holder to come back with it (`before-koga-absent-guide-says-wait.png`). After: Koga stands at the head of his hall straight after the win (`after-koga-there-same-raid.png`), and both guides say what is true for the badges held: Cerulean's after Misty (`after-cerulean-guide-after-misty.png`), Fuchsia's holding CASCADE (`after-fuchsia-guide-holding-cascade.png`) and after Koga (`after-fuchsia-guide-after-koga.png`).

**The Coast's rain.** Before: a RAIN chip and nothing else, on the map and in Misty's fight (`before-coast-rain-chip-only.png`, `before-misty-fight-no-rain.png`). After: light FireRed-style streaks and splashes over a slightly darker picture wherever it rains out of doors (`after-coast-rain-on-the-map.png`, test-mode build; `after-coast-rain-real-speed.png`, a plain build at 60fps), and over the battlefield from "It started to rain!" to "The rain stopped." (`after-misty-fight-rain.png`). Reduced motion keeps the rain and the shade but holds the drops still.

Made with `tools/playtest/gymsSameRaid.mjs` against a `VITE_EPTW_TEST_MODE=pixels` build served under its Pages subpath (`tools/playtest/README.md`, Memory), `LEVEL=16 MISTY_ONLY=1` for the fight in the rain. The real-speed picture is a plain build deployed at Cove Steps with Misty beaten. The before pictures are the tester's.
