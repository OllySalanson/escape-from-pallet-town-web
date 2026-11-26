# The graveyard's Gastly: the menu after a swap, and the cure for paralysis

Olly, 26 Nov 2026, against the Gastly in the Moor Chapel's churchyard: he swapped to his Pikachu, pressed OK to attack, and the team opened again. And he was paralysed the whole fight, new to battling, and wondered if an ANTIDOTE would cure it.

Paralysis was already FireRed's: it stays until it is cured, a paralysed Pokémon loses one move in four ("is paralysed! It can't move!") and its Speed is quartered, and the plate says PAR. Nothing said what cures it. The game has no Paralyze Heal; the cure in a raid is a CHERI BERRY, and the Pokémon Center's at base.

| | before (`main`) | after |
|---|---|---|
| the fight opens with a paralysed lead and a CHERI BERRY packed | `before/2-commands-after-the-line.png`: straight to the commands | `after/1-paralysed-line.png`: "CHARMANDER is paralysed! Choose ITEM to give it a CHERI BERRY." |
| the commands after that line | on FIGHT | `after/2-commands-after-the-line.png`: on ITEM, the command the line names |
| ITEM | `before/3-item-list.png`: opens on POTION | `after/3-item-list.png`: opens on CHERI BERRY, the item the line named |
| after swapping to PIKACHU | `before/4-menu-after-switch.png`: back on POKéMON | `after/4-menu-after-switch.png`: back on FIGHT |
| after swapping back | `before/5-menu-after-switch.png`: back on POKéMON | `after/5-menu-after-switch.png`: back on FIGHT |

Made with `node tools/playtest/graveyardBattle.mjs <url> <dir>` against a test-mode build of each (`VITE_EPTW_TEST_MODE=pixels npx vite build --outDir <dir> --base=/`, served as static files).
