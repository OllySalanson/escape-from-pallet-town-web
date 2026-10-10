# THE BOLTHOLE

The player's own house in the Harbour: FireRed's player's house, downstairs and
up, at the end of the keepers' row behind its window boxes, with a garden and a
sign. Nobody keeps it but you, so there is no counter and no screen behind the
door - what it is for is what stands in it.

| | |
|---|---|
| `harbour-before.png` / `harbour-after.png` | The whole Harbour with every one of Brock's rungs built, before and after (`tools/base/renderBase.mts -- out.png 2 --built=all`). Three columns more to the east hold the house and its garden; the mast moves beside the house; the Pokémon Center is FireRed's own building instead of the CC0 timber house. |
| `garden.png` | Reading the sign beside the path to the step: *THE BOLTHOLE - Home. Nobody hunts you here.* The door's caption says *Your house*. |
| `downstairs.png` | In through the door, on the mat. The sink and hob, the glass cupboard, the telly, the window, THE BADGE CASE, the table on its green rug, and the stairs up with the orange mat at their foot. |
| `upstairs.png` | Up the stairs on a Charmander save that has come home from three places: arriving on the matching orange mat, facing away from the stairs, with your starter tucked in after you. Three pennants on the wall, the rug in Charmander's red, the PC, the drawers, the bookcase of toys, the calendar, the bed and the console. |
| `badge-case.png` | Reading THE BADGE CASE with three keepers beaten: three badges lit, eight slots pressed into the velvet in the shapes still to win. Then a line for every badge in it. |
| `bed.png` | Lying down in your own bed: the screen goes dark for a moment, then a dream about the place you raid most and the rival who is next - and a reminder that healing is Nurse Joy's. |
| `badge-case-full.png` / `upstairs-squirtle.png` | The same rooms rendered with every keeper beaten, and with all five pennants on a Squirtle save (`renderBase.mts --room=bolthole --beaten=.. / --room=bolthole-upstairs --raids=.. --starter=squirtle`). |

All of the in-game ones are screenshots of a test-mode build at 3x, taken by
`node tools/playtest/bolthole.mjs <url> <dir> --starter=charmander
--beaten=floodplain-toll-keeper,overlook-warden,pallet-mill-keeper
--raids=floodplain-relay:6:4,route-1:3:2,pallet-town:2:1`, which walks the whole
house - sign, door, badge case, telly, stairs up, pennants, bed, PC, the console
four times, calendar, stairs down, and out onto the step - and fails if any of
it breaks, including a badge case that reads a different number of badges than
keepers beaten, a bed that does not send you to Joy, or a fourth game you do
not win.

## By the player's own clock

The rest of the house is the save; this part is the day you are playing on, read
off the browser's own local time each time you walk in (`base/homeClock.ts`).

| | |
|---|---|
| `october-dusk.png` | The real game on 10 October at half past five in the morning: the window gone orange for dusk, a jack-o'-lantern by the door, and a Squirtle at the player's heel. |
| `clock-day.png` / `clock-dusk.png` | The same room at noon and at seven in the evening in June (`renderBase.mts --room=bolthole --date=2026-06-15T12:00`). |
| `clock-halloween.png` | Ten at night on 31 October: the window dark with the stars out, and the pumpkin. |
| `clock-christmas.png` | Six in the evening on Christmas Eve: dusk in the window and a little tree in the corner, with a Poké Ball on top where the star should go. |

- **The window**: day from seven until six, dusk either side of it, night from
  nine until five. Face it and press Space and it says what is out there.
- **October**: a pumpkin by the door mat, all month.
- **December**: a tree in place of the corner plant, all month.

## What it reads off the save

Nothing in the house is stored; everything in it is the save you already have.

- **The badge case** - a badge for each of the eleven keepers, in the order the
  ladder meets them, lit by `raidProgress.defeatedBosses`. An empty slot shows
  its badge's shape pressed into the velvet. The door's caption in the yard
  says how many: *Your house · 3 of 11 badges*.
- **The pennants** - one for each of the five maps, hung once a raid has come
  home from it (`raidRecord[map].extracted`). A place only ever lost on earns
  nothing.
- **The telly** - *KANTO TONIGHT* reports on whichever rival hunts your next
  raid, in their voice, from the same rotation the hunter is drawn from.
- **The PC** - the raid log: raids, homecomings, losses, the place you raid
  most, and what Bill is keeping for you.
- **The calendar** - a day a raid.
- **The bed** - a dream, never a heal.
- **The rug upstairs** - red for Charmander, blue for Squirtle, FireRed's green
  for Bulbasaur.

## How it is drawn

The rooms are FireRed's own interior tileset drawn the way the Game Boy Advance
draws it, not a picture of a room: `scripts/cut-frlg-home.mjs` reads
pret/pokefirered's `building` tileset and names every piece by the metatiles
FireRed's own map of the player's house uses (`ASSET_PROVENANCE.md`,
`frlg-home.png`).
