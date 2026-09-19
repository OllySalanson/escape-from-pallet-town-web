# Double battles

Two Pokemon a side, on the one fight in the game that is worth two decisions a
turn: WARDEN HOLT, the last door in walking order on the Floodplain and the one
with the vault behind it. The engine is `src/game/pokemon/battle/battleEngine.ts`
(slots, `SlotRef`, `MoveTarget.BothFoes`); where the fight lives and why is the
note beside Holt in `src/game/world/trainers.ts`.

Shot at 3x (1200x768) from real play at real speed - `?testmode=pixels` is for a
frame that will be judged by eye, but the sprite entrance and the HP bars are
wall-clock tweens and a *stepped* check photographs them mid-slide, so these are
taken with the loop running. Deployed through the lobby with
`tools/playtest/deploy.mjs --team=squirtle:22 --beaten=floodplain-toll-keeper`,
walked to the tile Holt watches, and played through the real menus.

| | what it shows |
|---|---|
| `four-on-the-field-1200x768.png` | the double battle's own layout: two plate bands, the field between them, PSN on the partner's plate, and an ability announcing itself |
| `whose-move-1200x768.png` | the move list, leading its guidance line with the name of the Pokemon whose move is being chosen - a double battle asks twice before it resolves anything |
| `aim-at-which-1200x768.png` | the target step, offered only for a move that lands on one foe with two foes standing |
| `a-single-battle-unchanged-1200x768.png` | the same build fighting the Floodplain checkpoint: the authored 144-wide plates, the floating FOE and YOURS banners, the big sprites, the same command grid |

**What the double battle gave up to fit.** Four plates at 144x58 are 232 pixels
of plate in a field 174 tall, before a single sprite. So the double is a second
layout rather than a generalisation of the first - the single battle's numbers
are untouched - and its plates are 148 wide and three rows deep. What came off
is the floating WILD/FOE/RIVAL banner. Nothing is set below `CHIP_FONT_SIZE`:
the names, the levels, the HP numbers and the typing are all still 12px. The
typing is what a player reads to know what a move will do, so it moved onto the
plate itself; the role word is the one thing position already says, and the log
goes on naming "Foe PIDGEY" on every line.
