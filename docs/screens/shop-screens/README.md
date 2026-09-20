# What a thing does is not something you buy

The captain, playing, in the Outfitter:

> also I'm just in the outfitter and it tells me what things cost but only after
> I buy them does it actually tell me what they do So I've just managed to buy
> this secure locker one and now instead of the subtitle being the cost it says
> one more column of the secure container Now that we've got more screen space
> could we improve this somehow Although I do quite like the look of it at the
> moment Maybe the tooltip at the bottom come up with an elegant solution for
> this and these shop screens are really important because we've obviously got a
> lot of information on them I really like where we're going with it though

A rung's subtitle was its **price** while it was unbought and its **effect**
once it was built. So the one moment a player needs to know what a thing does -
deciding whether to buy it - was precisely the moment it was hidden, and the
screen explained the purchase only after the money was gone. He bought Secure
locker I without knowing what it was.

Nothing needed writing. Every rung in `hub/outfitter.ts` already carried both an
`effect` one-liner and a longer `detail`, and every item in the catalogue
already carried a `description`. The screens simply did not show them at the
moment they mattered.

## What a thing does is its identity, and identity does not change when you pay

`src/game/ui/shopDetail.ts` is the whole rule, Phaser-free, and both screens
render it.

- **The row's own line is always the effect**, before and after buying, so a
  ladder can be read for what it *is* rather than for what it costs.
- **The price is a column of its own on the right** - `shopPriceColumn`, one
  short line a part, red on whatever this vault cannot cover - which is what a
  shop shelf has always done: the thing on the left, the price on the right, and
  the eye runs down one column or the other. `COLUMN_MEASURES.priced` is the
  measure a list of those rows asks for.
- **A bought rung reads as bought** without that being the only way to learn
  what it was: the gold wash and the BUILT tick stay, and the price column says
  PAID.

`docs/screens/shop-screens/outfitter-before.png` and `-after.png`, both at
1600x900. Before, seven rows saying `Costs 2 Pokémon + 2× Parts crate`; after,
seven rows saying what each one does, with its price beside it.

## A price is only useful next to what you actually hold

The `.px-detail` pane under the list - the one PR #149 established and the
contract board and the stash already use - now holds the whole picture for the
row the cursor is on: what it does, the longer promise, the price **against what
this base can actually spend**, and whatever is stopping it.

- The held half is counted the way it is *spent*: `payablePokemonCount` never
  offers the last Pokemon fit to raid, and `spendableSupply` is only what stands
  above the wipe kit. A price beside a number the player cannot spend is worse
  than no number at all.
- A locked rung names the door it is behind (`outfitter-locked-rung.png`), a
  short one names what it is short of, and a shut deal on the boat names the
  standing it is waiting for - each in the ink a refusal is written in.
- The two blocks never wrap onto two lines at any width: stacked, the price
  falls under the fold, and the price is the half the row could not say.

## The Ferryman, both counters

`ferryman-before.png` and `-after.png`. Before, QUICK CLAW, FOCUS BAND and LIFE
ORB were three names and three prices and nothing about what any of them did;
after, each row carries the item's own catalogue line and the goods it takes.
The shelf gets the same treatment from the item's `description`, and his
barters' `detail` paragraphs were trimmed of the sentences that restated it -
`shopDetail.test.ts` holds that neither screen prints the same fact twice.

His screen is two counters on one page, which found two real bugs in
`MenuOverlay.showDetailFor`. It swept **every** `[data-shown-by]` on the screen,
so pointing at a Potion on the shelf blanked the pane under the barter table.
And once the swap was scoped to the control's own window, `closest('.px-window')`
turned out to be the wrong ancestor: a button or a chip wears that class too - a
window that is also a button keeps its frame - so from the KEEP THEM button on an
armed deal it returned *that button*, whose subtree holds no panes at all, and
the pane stopped answering for the deal being asked about. `detailGroupOf` walks
up to the nearest window that actually holds a pane. `shopScreens.mjs` caught the
second one: the pane is where what you get and what you hand over are both
written down, and the armed strip has room for neither.

## An irreversible deal is asked about, without a dialog

Found goods and a berth are spent for good, so neither goes through on one
press. The row becomes the question and two buttons, with the cursor on the one
that changes nothing - `ferryman-asks-again.png` - because the key that armed
the deal is still under the player's finger, which is why
`trainerChallengePrompt` opens on BACK AWAY and the Outfitter's payment bar
opens on KEEP. Nothing on the shelf is armed: a Potion for scrip is an ordinary
purchase and already rationed. While a deal is asking, no other row carries
`data-cursor-start` - `refocus` takes the first in the document, and a shelf row
still carrying one took the cursor off the armed strip and bought a Poke Ball
with the second press.

## Three rungs of room, not two

`roomFor` in `ui/columnLayout.ts` gained a **tight** rung: `BASE_STAGE` itself,
where a list, the band that answers for the row it is on *and* a second band
under that cannot share one pane. The Ferryman is the layout that runs out - his
standing, his shelf, the berth and his table - and at 320x240 a band sized for a
laptop left both lists with no rows in them. There his two counters stack, his
standing is its heading strip alone and neither list has a band at all: nothing
is lost that the screen does not already say, and the room goes to rows
(`ferryman-smallest-stage.png`). Every `[data-room='narrow']` rule in the
stylesheet carries a `[data-room='tight']` twin, which `columnLayout.test.ts`
holds - the failure would otherwise be silent.

## Driving it

`node tools/playtest/shopScreens.mjs <url> <out> [--window=WxH]` stands in front
of a rung you can afford, one you cannot and one behind a door, walking the
cursor with the arrow keys rather than the mouse, and asks each what it is, what
it costs, what you hold and what is stopping it. It fails a row that says only
one of those, a price whose asks do not line up, anything drawn off the screen,
a barter that spends its goods on the first press, and a pane that stops
answering for the deal it is being asked about. Verified clean at 680x520,
1024x640, 1366x768, 1600x900 and 1920x1080, with `menuShots.mjs --raid` at each
of them too - which covers the three screens PR #156 converted, since the
detail-pane scoping is shared with them - plus one plain-URL pass at real speed.
