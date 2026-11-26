# BROCK'S WORKSHOP and THE POKÉMON CENTER, after the critic tour

The harbour critic tour of 26 Nov 2026 scored the Workshop 5/10 and the Center
4/10. This change fixes what they said that was wrong, and the worst bugs:

- The build screen drew the ward as "+1 REVIVE A RAID". It gives three.
- One machine had four names.
- The money's description said nobody but Bill takes Pokédollars.
- BILL'S PC at the Center spent raid time on one ENTER.

`before/` is the critic's own pictures, on `main` at `4391c17e`. `after/` is
this change, played with `tools/playtest/ai-player/act` on a test-mode build
(`act start --rebuild --save=<file>`). The save was the critic's new-player
save with its Charmander fainted and today's free heal already used, so a heal
costs raid time. Test mode draws with the cheap renderer, so water and grass
have no tint.

| What | Before | After |
|---|---|---|
| The PC asks before spending raid time on a heal, and heals on the second ENTER | `before/1-pc-heals-on-one-enter.png` | `after/1-pc-heal-asks.png`, `after/1-pc-heal-done.png` |
| Joy says the price rule in her own words, without the cap | `before/2-joy-rule.png` | `after/2-joy-rule.png` |
| The ward is three, everywhere | `before/4-ward-plus-one.png` | `after/4-ward-three.png` (and the build picture, held by `workshopEffect.test.ts`) |
| One name a build, and a machine says its time | `before/5-radio-set-names.png` | `after/5-machine-one-name.png` |
| Brock says where materials come from, not the price twice | `before/6-brock-short.png` | `after/4-ward-three.png` (its second line) |

At the playtest's 400x256 window the build screen does not show its "In a raid"
pane, so the ward's build picture was checked by `workshopEffect.test.ts`, not
by a picture. BUILD IT's colour (`before/7-build-it-red.png`) is green now,
using the look's go button.
