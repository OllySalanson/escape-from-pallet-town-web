# The menu overhaul: show, don't list

The captain, 12 Nov 2026: "We just don't want these boring menu screens - they're
so cluttered and boring and make the game not fun to play." His standing rules
are the brief: progress he can **see** beats a ledger; menu screens use the whole
window and lay collections across it; a screen is judged by someone who does not
read, so the key things are found at a glance; and creative work iterates on real
screenshots against named benchmarks, with a scorecard.

This folder is the overhaul's record: every menu as it stood when it began, the
benchmarks, the rules every redrawn menu keeps, and one section per menu with its
before, after and scorecard. Menus are redrawn one at a time, most used first,
one pull request each.

## The inventory: every menu on 12 Nov 2026

All at 1280x800 on a realistic save (two dozen Pokémon, a shelf of supplies),
by `tools/playtest/menuShots.mjs --raid`, `teamAnywhere.mjs` and `yourThings.mjs`
against a test-mode build.

| Menu | Where | Picture | What a non-reader sees |
|---|---|---|---|
| YOUR TEAM | P anywhere in the harbour | [your-team.png](inventory/your-team.png) | a list of names and numbers; redrawn first (below) |
| YOUR THINGS | B anywhere in the harbour | [your-things.png](inventory/your-things.png) | a list of supplies; a pack grid does show things |
| Bill's PC (the stash) | the Pokémon Center | [stash.png](inventory/stash.png) | 24 rows of text in two columns, a dossier band |
| The bench | the Raid Arena hall | [loadout.png](inventory/loadout.png) | the stash's rows again, with ADD on each |
| The armoury rack | the Raid Arena hall | [rack.png](inventory/rack.png) | steppers and a pack grid of item icons |
| The locker | the Raid Arena hall | [locker.png](inventory/locker.png) | a container grid and a stepper list |
| The rim | the Raid Arena hall | [rim.png](inventory/rim.png) | one card over the pit |
| Brock's Workshop | his workshop | [workshop.png](inventory/workshop.png) | rungs of words with prices in words |
| Bill's cottage (barter) | his cottage | [bill.png](inventory/bill.png) | two shelves of words, prices in words |
| THE HARBOUR BOUTIQUE | the boutique | [boutique.png](inventory/boutique.png) | cards of figures - already pictures |
| The Day-Care | the day-care | [day-care.png](inventory/day-care.png) | rows of text and a dossier |
| The raid's PARTY | P in a raid | [party.png](inventory/party.png) | one row and a long dossier of words |
| The raid's PACK | B in a raid | [bag.png](inventory/bag.png) | a supply list over the pack grid |

Not DOM menus, so not in this table: the title (already the README's banner come
alive), the battle menu (FireRed's own), and the map maker. The old field guide
is no longer on a key: O is Professor Oak on the radio.

## The benchmarks

Named so a screen can be held up against them:

- **FireRed's party menu** - the art standard this game is held to. Six slots, each
  a party icon flapping between two frames at a pace set by its health, the
  chosen one bouncing; an empty slot is still drawn.
- **HeartGold's touch-screen party** - the six as big tiles two abreast, so how many
  you have is a shape, not a number.
- **FireRed's PC box** - a collection is a grid of little creatures, with the one
  under the cursor shown big beside it.
- **Hades' Mirror of Night** - words only for the thing being pointed at; everything
  else is a picture.
- **Tarkov's stash** - a grid of things laid across all the room there is.
- **Animal Crossing's NookPhone** - every choice is an icon a child could find.
- **Persona 5** - colour and motion make a menu feel like part of the game.

## The rules every redrawn menu keeps

1. **A thing is its picture.** A Pokémon is its FireRed party icon or its front
   sprite; an item is its icon. A name is printed for the one under the cursor,
   not for thirty.
2. **State is a colour or a shape, never a word on every row.** The lead is gold;
   a hurt Pokémon's icon flaps slowly and a fainted one stands still and grey
   (FireRed's own rule); capacity is empty slots, not "3 OF 6".
3. **One card answers for the cursor.** Portrait, types, health in figures, where
   it is kept - the collection and the answer about the thing in it are one
   screen (`docs/agents/ui-and-screens.md`).
4. **Little motion, all of it FireRed's.** Icons flap at `sMonIconAnims`' paces and
   the chosen one bounces as `SpriteCB_BouncePartyMonIcon` does;
   `prefers-reduced-motion` gets them still.
5. **Nothing new to source.** Every picture is art already shipped and recorded in
   `public/assets/ASSET_PROVENANCE.md` (`pokemon-icons.png`, the front sprites,
   the item icons).
6. **Every control and key path survives.** Arrows reach every slot and tile,
   ENTER does what it did, the find still narrows, and a driver proves it.

## YOUR TEAM (P anywhere in the harbour)

`ui/teamView.ts`, `ui/monIcon.ts`, the `YOUR TEAM` block at the end of
`src/style.css`. Pictures by `tools/playtest/teamShots.mjs <build> <dir>
--window=WxH` (and `--before` against a build of `main` from before), on its
save: 24 Pokémon in two boxes, three on the team, a few hurt and an Oddish fainted.

| | Before | After |
|---|---|---|
| 1280x800 | ![](your-team/before-1280x800.png) | ![](your-team/after-1280x800.png) |
| 1920x950 | ![](your-team/before-1920x950.png) | ![](your-team/after-1920x950.png) |
| 800x600 (a sheet) | ![](your-team/before-800x600.png) | ![](your-team/after-800x600.png) |

The cursor in the boxes, the fainted Oddish, and a Pidgey just taken:
![](your-team/after-cursor-in-boxes.png) ![](your-team/after-fainted.png) ![](your-team/after-taken.png)

### Scorecard

Measured by `teamShots.mjs` on the screen as drawn: the words wholly in view, the
Pokémon wholly in view, and the share of the panel that is picture.

| Measure | 1280x800 before | after | 1920x950 before | after | 800x600 before | after |
|---|---|---|---|---|---|---|
| Words in view | 110 | **44** | 139 | **50** | 71 | **42** |
| Pokémon in view | 9 of 24 | **15** | 12 of 24 | **24** | 5 of 24 | **13** |
| Panel that is picture | 0% | **32%** | 0% | **27%** | 0% | **27%** |

Against the benchmarks, out of 5:

| Benchmark | Before | After | Why |
|---|---|---|---|
| FireRed party: health at a glance | 2 | 5 | bars only, read row by row; now FireRed's own flap pace, bar and a still grey icon for fainted |
| HeartGold party: how many are going | 2 | 5 | "3 OF 6" and three rows; now six slots, three filled and three Poké Balls |
| FireRed PC box: the collection as creatures | 1 | 5 | a list of names; now a grid of party icons, six across as the box is |
| Hades: words only for the one pointed at | 1 | 4 | every row had a name, level, HP, box and TAKE; now one card (the find field and headings remain) |
| Tarkov: laid across the room | 2 | 4 | one column; now six across in the panel, ten in a sheet, the card beside it |
| Persona 5: motion and colour | 1 | 4 | still text; the icons flap, the chosen one bounces, type badges in colour |
| Every key path | 5 | 5 | arrows reach all 24, ENTER takes and leaves, FIND "box 2" narrows, P closes (`teamShots.mjs`, `teamAnywhere.mjs`) |

## The raid's PARTY (P in a raid)

`scenes/PartyScene.ts`, its slot shared with YOUR TEAM (`pixelPartySlot` in
`ui/monIcon.ts`). Pictures by `tools/playtest/partyShots.mjs <build> <dir>
--window=WxH` (`--before` against `main`), on its raid: five deployed, Pidgeotto
hurt, Nidorino in the red, Geodude fainted, Charmander leading with a Quick Claw
and Leftovers in the pack.

| | Before | After |
|---|---|---|
| 1280x800 | ![](raid-party/before-1280x800.png) | ![](raid-party/after-1280x800.png) |
| 1920x950 | ![](raid-party/before-1920x950.png) | ![](raid-party/after-1920x950.png) |
| 800x600 (a sheet) | ![](raid-party/before-800x600.png) | ![](raid-party/after-800x600.png) |

Pidgeotto picked up (the slot in hand is red), put down on the lead, and the
Leftovers given to Charmander from the pack - on its icon's corner at once:
![](raid-party/after-in-hand.png) ![](raid-party/after-new-lead.png) ![](raid-party/after-gave-leftovers.png)

What changed: the five rows are FireRed's six slots (the lead's gold, the sixth an
empty Poké Ball, the icons at their health's pace, the Geodude still and grey);
what a Pokémon holds is its own icon on the corner of its slot, as FireRed marks a
held item; the slot in hand turns red; and the dossier under them leads with the
portrait beside the name and health, its types under them, then the gear - in the
side column and in a tight sheet, where it used to end on the portrait below the
fold. The dossier's markup is shared with Bill's PC and is left for that menu's
turn.

### Scorecard

| Measure | 1280x800 before | after | 1920x950 before | after | 800x600 before | after |
|---|---|---|---|---|---|---|
| Words in view | 85 | **68** | 95 | **75** | 57 | **44** |
| Pokémon in view | 5 of 5 | 5 | 5 of 5 | 5 | 5 of 5 | 5 |
| Panel that is picture | 0% | **11%** | 4% | **9%** | 0% | **9%** |

Every Pokémon was already in view, so the gain is in what a glance gets from them:

| Benchmark | Before | After | Why |
|---|---|---|---|
| FireRed party: who leads, who is hurt | 3 | 5 | a LEADS tag and bars on rows; now the gold slot, the flap pace, the still grey icon |
| FireRed party: who holds what | 1 | 5 | "holding Quick Claw" in a row's small print; now the piece's icon on the slot |
| HeartGold party: how many | 2 | 5 | "4 OF 5 STANDING"; now five slots and an empty sixth |
| FireRed party: moving one | 3 | 5 | a HOLDING tag; now the slot in hand turns red |
| Hades: the one pointed at, big | 2 | 4 | the portrait was below the fold; now it leads the dossier (the numbers stay below it) |
| Every key path | 5 | 5 | arrows reach every slot, ENTER/ENTER swaps the lead, TAB gives and takes gear, ESC closes (`partyShots.mjs`) |

## The raid's PACK (B in a raid)

`scenes/BagScene.ts`. Pictures by `tools/playtest/packShots.mjs <build> <dir>
--window=WxH` (`--before` against `main`), on its raid: a party of three with
Pikachu hurt, and ten kinds carried - medicine, balls, two pieces of gear, a
Thunder Stone, a disc and a radio valve found on the way.

| | Before | After |
|---|---|---|
| 1280x800 | ![](raid-pack/before-1280x800.png) | ![](raid-pack/after-1280x800.png) |
| 1920x950 | ![](raid-pack/before-1920x950.png) | ![](raid-pack/after-1920x950.png) |
| 800x600 (a sheet) | ![](raid-pack/before-800x600.png) | ![](raid-pack/after-800x600.png) |

The cursor on the disc (the pane names it, its pocket, and who can learn it); a
Potion asking who for, before and after; and a Thunder Stone's ABLE and NOT ABLE:
![](raid-pack/after-disc.png) ![](raid-pack/before-potion-for-whom.png) ![](raid-pack/after-potion-for-whom.png) ![](raid-pack/after-stone-able.png)

What changed: every kind carried is its icon at twice its size with its count on
the corner, six to a row, pocket after pocket (the pockets' bands took a row each
and pushed the next pocket under the MORE strip; a Potion is told from a Poké Ball
by its picture). The name, its pocket, a disc's learners and the Bicycle's
riding are in the pane for the one under the cursor. Using an item asks who for
as FireRed's party does - the party slots, each with its HP for a Potion or ABLE /
NOT ABLE for a stone on a third line. The partner's place shows its icon, and
drops a SAFE tag the window's own heading already says.

### Scorecard

| Measure | 1280x800 before | after | 1920x950 before | after | 800x600 before | after |
|---|---|---|---|---|---|---|
| Words in view | 50 | **42** | 59 | **42** | 58 | **42** |
| Kinds in view (of 10) | 5 | **10** | 7 | **10** | 7 | **10** |
| Panel that is picture | 7% | **16%** | 6% | **14%** | 5% | **14%** |

| Benchmark | Before | After | Why |
|---|---|---|---|
| HeartGold bag: the things, big | 2 | 5 | 16-pixel icons in rows of words; now 32-pixel icons with their counts |
| Tarkov stash: everything in one look | 2 | 5 | half the kinds under a MORE strip; now all ten |
| FireRed party: who an item is for | 2 | 5 | rows of names and HP; now the party slots with icons, bars and the answer |
| Hades: words only for the one pointed at | 2 | 4 | a name on every row; now one pane (the help bar still speaks for the cursor) |
| Every key path | 5 | 5 | arrows reach every kind, ENTER uses a Potion on the hurt one, a stone asks ABLE, X drops, ESC closes (`packShots.mjs`) |

## Bill's PC (the Pokémon Center)

`HubScene.stashView`, its tiles shared with YOUR TEAM and the raid's pack
(`pixelMonTile` and `pixelItemTile` in `ui/monIcon.ts`). Pictures by
`tools/playtest/stashShots.mjs <build> <dir> --window=WxH` (`--before` against
`main`), on menuShots.mjs's save: two dozen Pokémon, four of them hurt, and a
dozen supplies.

| | Before | After |
|---|---|---|
| 1280x800 | ![](bills-pc/before-1280x800.png) | ![](bills-pc/after-1280x800.png) |
| 1920x950 | ![](bills-pc/before-1920x950.png) | ![](bills-pc/after-1920x950.png) |
| 800x600 | ![](bills-pc/before-800x600.png) | ![](bills-pc/after-800x600.png) |

The cursor on a hurt Sandshrew - its treatment's price in red where its level
would be, and the help bar saying what ENTER pays - and the moment after:
![](bills-pc/after-hurt.png) ![](bills-pc/after-treated.png)

What changed: the box is FireRed's PC box, a grid of party icons each at its
health's pace over its level and a short bar, the box's own bar (PREV, NEXT, SORT,
FIND, RENAME, NEW BOX) across its top; a hurt one at the Center shows what NURSE
JOY's treatment costs in raid time, in red, where its level would be, because
ENTER pays it. FIT, ON A RAID and GARDEN, which every row used to say, are the
dossier's and the help bar's to say. The supplies are the pack's item tiles,
twice their size with their counts, pocket after pocket.

### Scorecard

| Measure | 1280x800 before | after | 1920x950 before | after | 800x600 before | after |
|---|---|---|---|---|---|---|
| Words in view | 174 | **87** | 260 | **96** | 78 | **41** |
| Pokémon in view (of 24) | 14 | **24** | 24 | 24 | 4 | **12** |
| Supplies in view (of 13) | 13 | 13 | 13 | 13 | 7 | **13** |
| Screen that is picture | 3% | **17%** | 2% | **10%** | 2% | **23%** |

| Benchmark | Before | After | Why |
|---|---|---|---|
| FireRed PC box: the box as creatures | 1 | 5 | two columns of names; now the box as icons, two rows of twelve |
| FireRed party: who is hurt, at a glance | 3 | 5 | bars and red figures on rows; now the flap pace, the bar, and the price in red |
| Tarkov stash: everything in one look | 2 | 5 | 14 of 24 at 1280x800 and 4 at 800x600; now all 24, and 12 |
| HeartGold bag: the supplies, big | 2 | 5 | a list of names; now icons twice the size with their counts |
| Hades: words only for the one pointed at | 2 | 4 | 174 words; 87, most of them the dossier's |
| Every key path | 5 | 5 | the box bar, all 24 and all 13 by arrow key, the dossier follows, ENTER treats a hurt one (`stashShots.mjs`) |

## The bench (the Raid Arena hall)

`HubScene.benchView`, drawn as YOUR TEAM is: the same question, the same pieces.
Pictures by `tools/playtest/menuShots.mjs <build> <dir> --window=WxH` (its
`lobby`/`loadout` screen, Bulbasaur on the bench, 23 more at base).

| | Before | After |
|---|---|---|
| 1280x800 | ![](bench/before-1280x800.png) | ![](bench/after-1280x800.png) |
| 1920x950 | ![](bench/before-1920x950.png) | ![](bench/after-1920x950.png) |
| 800x600 | ![](bench/before-800x600.png) | ![](bench/after-800x600.png) |

What changed: the bench is six FireRed slots (the lead's gold, empty ones dim
Poké Balls, held gear on the icon), everybody else at base is a grid of party
icons under them, and the dossier with its treatment chips answers for the one
under the cursor, led by its portrait. The bar at the foot no longer lists the
names the slots show. In a window short of height (800x600, `data-short`) the
six slots become one strip of six tiles, icon over bar, or two rows of named
slots left no room for the box. The dossier's picture-first placement (the raid
PARTY's, now the bench's too) keeps the figure one box, so the fold reads it as a
row, and never gives way past the portrait and its MORE strip (80 pixels): below
that the types were cut in half.

### Scorecard

| Measure | 1280x800 before | after | 1920x950 before | after | 800x600 before | after |
|---|---|---|---|---|---|---|
| Words in view | 97 | **47** | 233 | **80** | 58 | **35** |
| Pokémon in view (of 24) | 7 | **19** | 16 | **24** | 3 | **9** |
| Screen that is picture | 0% | **22%** | 2% | **12%** | 0% | **16%** |

| Benchmark | Before | After | Why |
|---|---|---|---|
| HeartGold party: who is going | 2 | 5 | ticks on rows and names in the bar; now six slots |
| FireRed PC box: who could go | 1 | 5 | a list of names; now the box as icons |
| FireRed party: who is hurt | 3 | 5 | bars on rows; now the flap pace and the bar |
| Hades: the one pointed at, big | 2 | 4 | the portrait was below the fold; now it leads the dossier |
| Every key path | 5 | 5 | ENTER on a tile benches it, on a slot takes it off, TAB into the dossier's care, DONE back to the hall (`deploy.mjs` drives it on every raid) |
