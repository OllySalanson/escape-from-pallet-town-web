# Linked areas in a player map

Design note for building insides, caves and warps in the map maker. It is the
map file change first, then how the game plays it, then how the maker edits it.

## The file

A map file is still one file and one raid map, and it is still format 1: every
field below is optional, so a file written before them means exactly what it
meant (`mapFile.test.ts` holds the sample and an old-shape file to that).

- **`areas`** - places that are not the outdoor map. Each has a stable `id`, a
  `name` (the plate that rises when you walk in), a `kind` (`inside` or `cave`),
  a `style` (which FireRed room or cave it is dressed as), and its own `width`,
  `height`, `ground` and `buildings` - for an inside the buildings are its
  furniture. The outdoor map is the file's own `ground` and `buildings`, as
  before.
- **`area`** on every placed thing - drop-ins, exits, item spots, people,
  signs, landmarks, trainers and districts. Absent is outdoors.
- **`links`** - the ways between places. A link is two **ends**, and an end is a
  landing tile in an area, `toward` (the way you press to go through) and a
  `look`: `door`, `mat`, `stairs-up` and `stairs-down` in a building, and in a
  cave `cave-exit` (daylight cut into its south wall), `ladder-up` (stood on at
  its foot) and `ladder-down` (a hole, walked up to). A building's door is the
  `door` look standing on the tile in front of the building's door cell: linking
  it is what opens the door. A cave's mouth is a building too, `cave-mouth`,
  cut into the foot of a rock face, and its door is the mouth.
- **A building may have more than one door**, each pressed its own way
  (`MAP_FILE_BUILDING_DOORS`): a gatehouse is walked through from one side to
  the other, so it has two - up its steps into its door and down off the ridge
  of its roof for one that is walked through north to south, and into a porch
  from either side for one walked through west to east - and its room has a way
  out on each side: a `back-door` let into the back wall, or a `mat` let into
  a side wall (`toward` `left` or `right`). Which way a door is gone through is
  read off FireRed's own floor behaviours, and a room may be cut to a shape
  that is not a box with the dark beyond its walls (`C`), as FireRed cuts the
  east-west gatehouse, dark down both sides but for the mat let into each.

## Going through

You stand on a landing and press toward its doorway - the door, the mat's edge
of the room, the cave mouth, the ladder - and you come out on the other end's
landing facing away from its doorway. That is FireRed's own rule for a door mat
and a cave's arrow exit, and it makes every link **symmetric**: landing to
landing, both ways. So a link is one more edge from a tile, and nothing else.

## Playing it

`buildPlayerMap` lays every area into **one composite grid** - outdoors at the
origin, each area packed to its east with solid void between - so a player map
is still one `WorldMapDefinition`. Nothing that walks, searches or seats loot has
to know areas exist: the hunter's pursuit, its arrival ring, the flee's doors,
the checks' walks and the standing board all read one collision grid whose
`GridBounds.links` adds the link edges (`hunter.ts`, `mapStructure.ts`). The
hunter therefore follows you through a door - an inside is a place, never a safe
box, and a one-door house is a dead end you chose.

Going through is a same-map warp: a fade, a move, a fade, nothing rebuilt. The
camera frames the area you are in, centred on black when it is smaller than the
screen as a FireRed room is (`BaseScene` already frames its rooms that way),
and a black mat covers everything outside that area. Each area is a district of
the map, so its name is the arrival plate. A cave's floor rolls for wildlife on
every step, as the Delve's does (`interiors.ts`), from Mt. Moon's own table
(the `cave` habitat). It is not dimmed: Mt. Moon is lit, and dark is
atmosphere, never a lock.

## The checks

The same "does it work" checks, measured over the composite with its links,
and every problem names the area it is in. Two more: **every door leads
somewhere** (both ends in an area that exists, on ground you can stand on, the
doorway itself shut, nothing else on the landing) and **every area can be walked
into** from a drop-in. "Every area can be left" follows: a link is two-way.

## Making it

The maker edits one area at a time through a switcher - OUTSIDE, then each
inside and cave. Editing an area is editing a *focused view* of the file
(`maker/areas.ts`): the area's ground and buildings and the things standing in
it, as a map file of its own, so every brush, tool, the canvas and the map's
growth work on an area exactly as they do outdoors, and the edit is written back
into the file whole. Drawing past the outdoors' edge grows the map, and the
outdoor end of every link moves with it; an inside or a cave is the size its
own fields say. A building's **MAKE ITS INSIDE** makes its inside from the
FireRed room that building is and links its door; a cave mouth's **MAKE ITS
CAVE** makes a cave ringed in rock the way Mt. Moon is, with its way out cut
into the south wall, and **ADD A FLOOR BELOW** digs the next floor down and
links the two by a ladder. A passage between two places that already exist is
two clicks - the entrance, then where it comes out - and a chosen way through
names where it leads and goes there.

## Shipping order

1. Data model and doors: areas, links, building insides dressed in the FireRed
   room art the base already ships, the switcher, the checks.
2. Interiors: more FireRed rooms and furniture cut from pret's FireRed tilesets.
3. Caves: FireRed cave art from pret, cave mouths on rock, ladders, cave
   wildlife, the passage tool.
4. Every building has a way in: Kanto's town buildings open where FireRed's
   own maps put their doors (read off pret's warps, only the ones FireRed
   fires), and a door is as wide as FireRed draws it - every cell of a wide
   door leads in, onto the middle of the mat, which is the one tile of it that
   leads out, as in FireRed. Only the links that go both ways are walked by
   the searches; a wide door's other cells are ways in for a player.
5. Gatehouses: FireRed's own - Route 2's and Saffron's walked through north to
   south, Saffron's west to east - each a building with a door on either side
   of it and its room between, cut from pret: the building off the route it
   stands on, the room off its own layout.
6. The Underground Path: a hut, a stairwell down, a tunnel, and a hut where it
   comes out - a way through that comes out somewhere else on the map.
