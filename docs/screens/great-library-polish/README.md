# THE GREAT LIBRARY, its chart room and its windows: before and after

The owner's playtest of 12 Nov 2026, in his words: the pieces "don't really
align with each other", "it's not clear what objective I've been sent", in
playtest mode "I already had all of them on me", and "the great library's got
three windows. If it's daytime, those windows should be daytime". He liked
being led into a secret room by the old chart keeper, and that is untouched.

Every picture here is the game's own, at the real 3x window, in this machine's
own headless browser against a test-mode build. The before set was made on
`main` at `30a4b938` and the after set on this change, by the same driver:

```bash
node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir>             # a normal player
node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> --playtest  # the explorer run
node tools/playtest/treasureHunt.mjs <cdp port> <url> <out dir> --windows   # day, dusk, night
node tools/playtest/raid.mjs <url> --attach=<cdp port> --fresh --stepped --pixels --window=pixel \
  --insertion=greystone-vale-cove-steps --beaten=vale-gym-misty --hunt=shore,moor,hollow,fold \
  --level=40 --steps=radio,walk:91:302,shot:x-on-the-sand --grab=sea-chest --skip-contract --shot=dig.png
```

One pass was also played at real speed on a plain production build.

## The board

| Before | After |
|---|---|
| ![](before-board-empty.png) | ![](after-board-empty.png) |
| ![](before-board-three-pieces.png) | ![](after-board-three-pieces.png) |
| ![](before-board-whole.png) | ![](after-board-whole.png) |

Before, the chart was a picture of nowhere: a coast that jumped sideways across
the middle seam, a tor, some pines, a cove, a strip of board between every
piece. After, it is SMUGGLERS' COVE read off the vale's own map at two pixels a
tile, on a board two tiles wider and one taller: the wooded cliff top, the
steps down, the huts, the long jetty, the boat shed, the sand spit, the name
lettered on the bay, a red course down the real walk from the COVE STEPS
landing, and the X on the tile the chest is under. It is one sheet torn along
two lines every piece shares, so pieces meet with nothing between them.

And the place on the board is the place in the raid:

![](after-the-x-on-the-sand.png)

## The words

| Before: the first piece, fifteen boxes | After: the first piece, seven |
|---|---|
| ![](before-first-piece-fifteen-boxes.png) | ![](after-first-piece-seven-boxes.png) |

Every line MARLOW says now fits one box. The last piece went from thirteen
boxes to seven (eight while MISTY still holds the coast), and ends on the goal:
where the X is, what is under it, who to carry it to.

## The objective

The whole chart is one goal, said in the same few words wherever a player looks.

| Where a raid is planned | Oak on the radio |
|---|---|
| ![](after-the-x-on-the-telescope.png) | ![](after-oak-on-the-radio.png) |

| The field guide's first note | What the X leads to |
|---|---|
| ![](after-the-field-guide.png) | ![](after-the-rare-find.png) |

## The explorer run

| Before | After |
|---|---|
| ![](before-explorer-run-marlow-opens-a-chest-nobody-dug-up.png) | ![](after-explorer-run-says-so.png) |
| ![](before-explorer-run-end.png) | ![](after-explorer-run-end.png) |

Before, the kit held twenty of every piece and twenty SEA CHESTs, so MARLOW
opened a chest nobody had dug up the moment the chart was whole and nobody was
sent anywhere. After, it holds one of each piece and no chest, the board says
the pieces are the kit's, and the whole chart sends the run to the X like
anybody. A run kept from before is brought to the same rule on the way in.

## The windows

| Before, at eleven in the morning | After: day |
|---|---|
| ![](before-library-at-eleven-in-the-morning.png) | ![](after-library-day.png) |

| After: dusk | After: night |
|---|---|
| ![](after-library-dusk.png) | ![](after-library-night.png) |

The clock is the one THE BOLTHOLE's window and the harbour's light keep
(`homeClock.ts`): day from seven until six, night from nine until five, dusk
either side. It has no dawn, so dusk is both ends of the day.

## Scorecard: FireRed-era puzzle clarity

FireRed's own item hunts (the Itemfinder's ping, the Gold Teeth, the Tea, the
S.S. Ticket) are judged here by what a player can tell without reading a guide.
Scored out of five, before and after.

| What FireRed gets right | Before | After | Why |
|---|---|---|---|
| The clue is a picture of the place | 1 | 5 | The chart was an invented coast; it is now the cove's own tiles, sheds and jetty, with its name on it. |
| Pieces of a puzzle visibly fit | 2 | 5 | A coast that broke at the seam and board between every piece; now one sheet, shared tears, chalked shapes for what is missing. |
| You are told where to go, once, briefly | 2 | 5 | Four long lines about a moor and pines the X was never in; now two short ones: the place and the spot in it. |
| You are told what you get | 2 | 4 | "Whatever is under that X"; now the SEA CHEST by name. What is inside stays a surprise, as a FireRed item ball's does not, so not a five. |
| The goal is still there when you come back | 1 | 5 | Only MARLOW, if asked. Now the board, MARLOW, Oak's table, the telescope, the radio and the field guide. |
| The spot itself answers the clue | 3 | 5 | A hidden tile beside a marker post; now the chart's own X on the sand. |
| What blocks you is named | 3 | 5 | MISTY was one clause in a long last line; now a line of her own, said only while she is in the way, and on the telescope and the radio. |
| Text is short enough to be read | 1 | 4 | Fifteen boxes for the first piece; seven. MARLOW's welcome in the library is as long as it was, because the owner liked it. |
| The reward is worth the walk | 3 | 5 | Money, a pack and balls; and now a shiny EEVEE, the one certain shiny the vale hands over rather than makes you fight for. |
| A test tool does not break the puzzle | 1 | 5 | The explorer run skipped the dig entirely; it now plays the hunt's ending as a player does. |
| **Total** | **19 / 50** | **48 / 50** | |

Still short of FireRed: the first three pieces are found under a sky the player
has to learn about from the harbour's rumours, which is the secrets' own design
and not this change's to alter.
