# The graveyard's Gastly: the menu after a swap

Olly, 26 Nov 2026, against the Gastly in the Moor Chapel's churchyard: he swapped to his Pikachu, pressed OK to attack, and the team opened again. The menu came back on the command last used, and after a swap that was POKéMON. Now it comes back on FIGHT after any Pokémon is sent out.

| | before | after |
|---|---|---|
| after swapping to PIKACHU | `before/4-menu-after-switch.png`: back on POKéMON | `after/4-menu-after-switch.png`: back on FIGHT |
| after swapping back | `before/5-menu-after-switch.png`: back on POKéMON | `after/5-menu-after-switch.png`: back on FIGHT |

He was also paralysed the whole fight and wondered if an ANTIDOTE would help. Paralysis is FireRed's: it lasts until cured, a paralysed Pokémon loses one move in four ("is paralysed! It can't move!") and its Speed is quartered, and the plate says PAR. #979 briefly added a line naming the cure; Olly ruled it out (Pokémon knowledge a player can look up, not the game's to explain), and it was taken out again.

Made with `node tools/playtest/graveyardBattle.mjs <url> <dir>` against a test-mode build of each (`VITE_EPTW_TEST_MODE=pixels npx vite build --outDir <dir> --base=/`, served as static files).
