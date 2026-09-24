# Bill's cabinet of oddities

Everything you barter to Bill now turns up on a shelf in his cottage. Trade
him three parts crates and a mooring rope for the Focus Band, back out of his
screen, and the crates and the rope are standing on the shelf by his desk. The
shelves fill in the order you traded, and nothing ever moves once it is up, so
the first rope you gave him is where it was the last time you looked.

All of these are real screenshots of a test-mode build at 3x, taken by
`node tools/playtest/billCabinet.mjs <url> <dir> [--traded=N]`, which plays the
whole loop and fails if any of it breaks.

| | |
|---|---|
| `before.png` | A fresh save walking into the cottage. The two shelf units either side of the desk are empty; walk up to one and it says it is waiting on your first trade. |
| `traded.png` | Striking the Focus Band at Bill's table. The line at the foot says where the goods went: *It goes on his shelves.* |
| `after.png` | Straight back out into the cottage: the three crates and the rope are on the first shelf. |
| `facing.png` | Walk up to the cabinet and face it. The caption counts everything you have ever traded him, and the hint says the interact key looks closer. |
| `inspect.png` | Looking closer. One thing is framed in gold and one label says what it is, what it went for and when. Every other caption in the room goes quiet. |
| `inspect-along.png` | The arrow keys walk along the shelf, and on across the aisle into the other unit. The player does not move. |
| `pointer.png` | Resting the mouse on anything on a shelf asks the same question, with no key pressed. |
| `second-pair.png` | About sixty things in. The first two units are full, so a second pair has been carried in beneath them. |
| `full.png` / `full-inspect.png` | Several hundred things in. All four units are full and Bill has started packing what comes next into crates stacked behind the first pair; the crates say how many they hold and across which days. |
| `smallest-stage.png` | The same room on the smallest screen the game supports (320x240). |

## How it fills

- **One thing on a shelf for every unit handed over.** A barter that takes two
  linen rolls and a lamp oil puts three things up.
- **Four units, 24 seats each.** The two by the desk stand from the start; the
  second pair is carried in beneath them once the first is full.
- **Then crates**, stacked behind the first pair: twelve things a crate, ten
  crates, and the last one takes whatever is left, so the room never runs out.
- **It is kept in the save**, as Bill's book: every deal, what it cost *then*
  and the day. A barter you made before this change is still shown - the
  once-only deals are already recorded, so their goods go on the shelf first,
  labelled *a while back*.

## Benchmarks and scorecard

Three FireRed/LeafGreen interiors, because that is the game the base is
dressed as and the bar the room has to clear:

1. **Professor Oak's Lab bookcases** - the scale reference. A FireRed book on
   a shelf is a spine two pixels wide and four tall, and a shelf reads as
   *full of things* from colour and rhythm, not from detail.
2. **The Pewter Museum of Science** - the inspection reference. Every exhibit
   is walked up to and read one at a time with the A button; nothing in the
   hall talks until it is asked.
3. **Bill's Sea Cottage** - the room itself: the cell separators, the PC, the
   desk, and a lot of quiet floor.

| | bar | where it stands |
|---|---|---|
| Every bartered thing is visible | a thing per unit traded, in the room, with no menu | Met. `cabinet.test.ts` holds the shelf to the book; the playtest counts the shelf after a real trade. |
| Scale matches the shelf it stands on | no taller than a FireRed book (4px) | Met. Every miniature is four pixels tall and at most five wide, drawn in the colours of its own 16px icon. |
| Things can be told apart by eye | six materials, six silhouettes | Met, with a caveat: at 3x a crate, a spool, a coil of rope, a lamp, a valve and a bolt of linen read as different things by shape and colour, but not by *name* until asked - which is the Oak's Lab bookcase too. |
| Read one thing at a time | the museum: walk up, press, one line | Met. Keys and pointer both; one label at a time, every other caption hushed; the player never moves while looking. |
| Says what it is and when | name, what it went for, the day | Met. *MOORING ROPE - For the Focus Band, 24 Sep*; a year appears only when it is not this one. |
| Many items without clutter | shelves fill, then more cases | Met. 96 on shelves across four units, then up to ten crates; nothing moves once placed. |
| The room still looks like Bill's house | sparse, FireRed furniture only | Met. Every piece is from the FireRed sheet; the cottage is two rows deeper to make room for the second pair. |
| Re-kitting is not slower | the keeper one key from the mat | Met: the mat still opens Bill's screen. Walking up to him is now four steps rather than two. |
| Can be done from where you stand | a prompt only where its key works | Met. *LOOK CLOSER* shows only facing a unit with something on it; an empty cabinet says how it fills, with Bill standing beside it. |

One honest gap against the original idea: the idea mentions *the Moon Stone you
traded away*, but Bill never takes a stone - he gives them - so what fills his
shelves is the six materials his barter table takes.
