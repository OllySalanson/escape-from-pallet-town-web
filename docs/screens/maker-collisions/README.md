# What the map maker does when one thing is put where another is

`tools/playtest/makerCollisions.mjs` in one headless browser at 1280x800,
against a test-mode build of `main` (`--before`) and then of the change, and
`tools/playtest/makerCollisionSheets.mjs` to put each case's shots side by
side. Each sheet shows three pictures, top to bottom:

1. **Before - after the click**: the map as `main` leaves it.
2. **Now - before the click, the ghost**: the thing itself, where it would go.
   It is green where it fits and red where it does not, with the tiles that
   refuse it crossed, what it would clear shown faintly in amber, and its
   doorstep dotted.
3. **Now - after the click**: the map as it is left now.

Under each picture is the line the foot of the screen said, or NOTHING SAID.

The captain's own case, a Gym dropped on a block of trees:

- `gym-in-forest.png`: dropped in the middle of a wood.
- `gym-on-forest-edge.png`: its roof on grass and its walls in the trees.
  On `main`, the trees' tips are drawn through the roof.
- `gym-carried-into-forest.png`: carried there with Select.

Buildings and what was already there:

- `house-on-house.png`
- `house-on-clutter.png`: a tree, a crate and a stump, cleared.
- `house-on-spots.png`: a berry tree, a person, an item and a sign, refused.
- `house-on-water.png`
- `house-on-rock.png`
- `house-on-doorstep.png`
- `door-onto-water.png`
- `door-onto-trees.png`
- `leaves-over-roof.png`
- `tree-on-tree.png`
- `move-house-onto-house.png`

Things and what was already there:

- `berry-on-house.png`
- `berry-in-trees.png`
- `berry-under-leaves.png`
- `berry-boxed-by-person.png`
- `person-on-berry.png`
- `cut-tree-on-berry.png`
- `drop-in-past-edge.png`: the map grows, and the drop-in stands in a
  clearing of the new wood.

Painting round what stands there:

- `paint-water-under-house.png`
- `paint-trees-over-spots.png`
- `berry-boxed-by-painting.png`
- `trees-into-wall.png`

The checks, on a map made before the rules (seven berry trees stood in a
wood, a swimmer in a pond and a sign on a house):

- `checks-before.png`: `main`.
- `checks-after.png`: grouped by kind with a count, every tile a button.
- `checks-jumped.png`: after pressing the heading. The view is centred on
  the first berry tree, which is chosen and flashed, and the foot of the
  screen says "1 of 7".
