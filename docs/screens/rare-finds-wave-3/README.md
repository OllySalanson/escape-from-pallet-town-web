# Rare finds, wave 3: four Pokémon the vale had nowhere

Until this change sixteen of the 151 could not be had on Greystone Vale at all,
and only one of Eevee's three evolutions could, so Oak's last Pokédex milestone
could never be paid. Wave 3 of the vale's secrets (`src/game/world/secrets.ts`)
puts four of them in, each in a place that already had half the story:
a Hypno, a Lickitung, a Mr. Mime and a Gengar - with a Drowzee dozing beside
the first. `src/game/world/pokedexReach.test.ts` works out from the game's own
data which kinds a save can come to own, and lists by name the eleven it still
cannot.

Played end to end in a test-mode build (`VITE_EPTW_TEST_MODE=pixels`, served as
the playtest README says) by `tools/playtest/raid.mjs --pixels --window=pixel
--seed=7 --skip-contract`, attached to one headless browser (`--attach=PORT
--fresh`). The "before" pictures are the same walks on a test-mode build of
`main`.

## How to find each one

| Find | Where | What it waits for | Heard from |
| --- | --- | --- | --- |
| THE LOST PICNIC: Hypno, Lv 26 | Tanglewood's north glade, up the long lane past the mushroom ring. Nearest landing: Farmhouse, north up the Pickers' way. | A night raid (your own clock). A Drowzee, Lv 10, dozes by the bench at any hour. | The harbour board |
| THE STICKY TONGUE: Lickitung, Lv 24 | Orchard Terraces, the gap behind the cider press's barrels, a short walk east of the Farmhouse landing. | Any berry in the pack as the raid sets out. | The Seagallop's sailor |
| THE SILENT PICKET: Mr. Mime, Lv 22 | The Power Station's picket line, on the forecourt The Dam lands on. He stands there every raid. | A Psychic type leading the party. A Slowpoke will do: one stands in THE WARM WATER just east of the forecourt, and another at THE ANGLERS' STAGE in The Crossing. | The S.S. Anne's captain, through his glass |
| THE SHADOW IN THE CRYPT: Gengar, Lv 25 | Under THE MOOR CHAPEL, which only a night raid reaches: from Moor Top along the sheep track, in at the chapel door, down the nave's stairs. It lies there every raid. | A Ghost type leading the party (the churchyard above is where to catch a Gastly). | Bill |

Each is fought as a wild Pokémon and is only yours once it is carried home. A
level is set so the fight is earned: three starters at Misty's level lose to
each more often than not (`secrets.test.ts`).

## THE SILENT PICKET

`--clock=day --insertion=greystone-vale-the-dam --steps=walk:290:91,shot:line,read:289:90:up,read:292:90:up`,
then again with `--team=slowpoke:22 --lead=Slowpoke --level=30 --fight --shot-battles`.

| | |
| --- | --- |
| ![](01-picket-line-before.png) | Before: the pickets either side of the station's doors, nine years out. |
| ![](02-picket-line-after.png) | After: one more on the east end of the line, between the banners and the sandwiches. He stands every raid until he is had, still on his first frame. The Scab stands a step east of where he did, so the picket is spoken to from the forecourt. The picket beside him is the clue: "Him on the end? Nine years, not a word. He only ever turned his head for a lad with a PSYCHIC type in front." |
| ![](03-the-picket-says-nothing.png) | Spoken to with a Bulbasaur in front: nothing. |
| ![](04-a-psychic-in-front.png) | With a Slowpoke leading: "The silent picket turns its head. It has heard something think." |
| ![](05-mr-mime-lv22.png) | A wild Mr. Mime, Lv 22. |

## THE STICKY TONGUE

`--clock=day --insertion=greystone-vale-farmhouse --steps=walk:247:220,shot:yard`,
then again with `--stash=pecha-berry:2 --pack=pecha-berry:1 --level=30 --fight --shot-battles --steps=walk:247:220,shot:yard,read:247:219:up`.

| | |
| --- | --- |
| ![](06-press-no-berry.png) | With no berry packed: the gap between the press's barrels and the wood is empty, which is also how it looked before. The Cider Maker is the clue: "Something behind my barrels licks them clean round the bung. It only comes out for a BERRY brought in a pack." |
| ![](07-press-with-a-berry.png) | With a Pecha Berry packed at the rack: something pink in the gap. A berry picked on the way is picked too late, because a secret's condition is read as the raid sets out. |
| ![](08-lickitung-wants-that-berry.png) | "Something pink unrolls out of the gap behind the barrels, sniffing at your pack." |
| ![](09-lickitung-lv24.png) | A wild Lickitung, Lv 24. The driver's Bulbasaur lost, and the pack went with it. |

## THE LOST PICNIC

`--clock=day --insertion=greystone-vale-farmhouse --level=30 --avoid-watch --steps=walk:221:133,shot:glade,read:219:133:up,read:220:132:up`,
then `--clock=night ... --shot-battles --steps=walk:221:133,shot:glade,read:218:131:up`.

| | |
| --- | --- |
| ![](10-lost-picnic-before.png) | Before: the picnicker who "took one turn off the road" this morning, some time ago. |
| ![](11-lost-picnic-by-day.png) | After, by day: the glade has a name on its plate, and a Drowzee dozes by the bench at any hour - the only one in the vale, Lv 10, fought when spoken to. |
| ![](12-the-picnickers-clue.png) | The picnicker's new third line is the clue: "Something stands by the bench after DARK, swinging a weight on a string. I always nod off before I see it." |
| ![](13-lost-picnic-by-night.png) | On a night raid: a Hypno stands at the back of the glade, over the Drowzee. |
| ![](14-hypno-was-not-expecting-that.png) | "A little weight swings on its string, to and fro, to and fro... You shake your head clear." |
| ![](15-hypno-lv26.png) | A wild Hypno, Lv 26 - the level a Drowzee turns into one. |

## THE SHADOW IN THE CRYPT

`--clock=night --insertion=greystone-vale-moor-top --level=30 --steps=walk:70:82,walk:58:82,walk:50:82,walk:44:82,into:27:94:up,into:491:103:left,walk:500:122,shot:chamber,read:502:123:up,read:498:126:up`,
then again with `--team=gastly:25 --lead=Gastly --shot-battles`. The driver stops in the crypt, because its
walk out does not go back up the stairs; `--through=... --deep` is the walk that does (`docs/screens/greystone-vale/README.md`).

| | |
| --- | --- |
| ![](16-crypt-before.png) | Before: the crypt under the nave, the gold graves and the Grave Goods. |
| ![](17-crypt-after.png) | After: a shadow lies on the floor at the foot of the gold graves every raid until it is had, and a keeper's notice stands inside the ring of stones. |
| ![](18-the-keepers-notice.png) | The notice is the clue: "The shadow at the foot of the gold graves is nobody's. Leave it be. It only gets up for a GHOST walking in front." |
| ![](19-nothing-to-cast-it.png) | Spoken to with a Bulbasaur in front: "There is nothing in the crypt to cast it." |
| ![](20-a-ghost-in-front.png) | With a Gastly leading: "the shadow sits up and grins. GENGAR peels itself off the floor!" |
| ![](21-gengar-lv25.png) | A wild Gengar, Lv 25. A Haunter turns into one only by trade, which this game does not have, so this is the vale's one. |

## What else changed

- THE GREAT LIBRARY's golden book, VALE SECRETS, is written from the secrets themselves, so it has four more pages.
- Oak's cork board pins a scrap for every rumour heard. Seventeen rumours wanted a third column of scraps, which would have left the notices two slips, so a row of scraps now fills its corner exactly and two columns hold twenty.
- `tools/playtest/raid.mjs` learned `--lead=Name` (who walks in front, which is how a secret that waits for a type is played) and `--fresh` (empties an attached browser's save before the raid), and a `read` step waits for its line to finish typing before it is photographed.
