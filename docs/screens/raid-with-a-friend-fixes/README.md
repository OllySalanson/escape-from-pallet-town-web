# Raid with a friend: what the bug hunt of 9 Nov found, before and after

Two tabs of one browser as two friends, OLLY and AMY, on the local stand-in
(`?harbour=local`), against two test-mode builds: `main` at `d297049d` (before)
and this branch (after). Every picture was taken by a driver, before the check
it shows:

```bash
node tools/playtest/friendLoot.mjs <url> <dir> [--keep-going]   # l0-l3
node tools/playtest/rimRefusal.mjs <url> <dir>                  # r2
```

`--keep-going` says each fault and plays on, so one run of the old build
photographs every check. Its faults on `main`, word for word:

```
OLLY's raid in a room has no stake: []
OLLY's raid in a room lays nothing for its open secrets the-lost-fold
AMY's raid in a room has no stake: [{"id":"errand-oaks-parcel", ...}]
AMY's raid in a room lays nothing for its open secrets the-lost-fold
AMY still sees greystone-vale/spot-78: {"gone":[],"drawn":true}
AMY, her room closed, could not pick up greystone-vale/spot-78: {"gone":false,"bag":{"potion":3,"poke-ball":3},"chip":"OLLY BESIDE YOU / ..."}
AMY's chip never said the room closed: "OLLY BESIDE YOU / [T] SAY  [G] PING"
```

and the rim: `the rim's refusal is not on screen: {"text":"A raid is already
under way in another window. Finish it there first.","width":0,"height":0}`.

| | Before | After |
|---|---|---|
| **A room raid keeps the player's own stake and secrets.** OLLY lands in Mill Square in a room. | `before-l0-olly-lands-with-his-stake.png`: no stake on the map, the chip says FIND LOOT, and the open secret's chart piece is not laid. | `after-l0-olly-lands-with-his-stake.png`: the ₽10 on the way to his ₽75 stake, its marker and chip, as a raid alone has; the-lost-fold's chart piece is laid at its nook. |
| **A piece taken on the vale goes from every map.** OLLY picks up the piece nearest the landing. | `before-l2-amy-sees-it-gone.png`: AMY's map still has it. Every vale piece is named `greystone-vale/spot-N`, which the room refused: on the live game every claim was turned away and nothing in a friend raid on the vale could be picked up at all; here OLLY's word that he took it was thrown away. | `after-l2-amy-sees-it-gone.png`: gone from AMY's map too. |
| **A room closed under a raid.** The stand-in takes AMY out of the room, as the database does when its hour runs out or she joins another room in another tab; she walks to a piece and stands on it. | `before-l3-amy-room-closed-picks-it-up.png`: the piece stays, her pack does not change, and nothing is said. | `after-l3-amy-room-closed-picks-it-up.png`: picked up on the step ("Found Pok..." typing out), and the chip says ROOM CLOSED: WHAT YOU FIND IS YOURS. |
| **A refusal at the rim is said.** OLLY is raiding in one tab; the other tab, on the same save, presses JUMP IN at the rim. | `before-r2-jump-in-refused.png`: the denied sound and an unchanged card. | `after-r2-jump-in-refused.png`: the refusal in the status bar, square under the card, until it is taken down. |
