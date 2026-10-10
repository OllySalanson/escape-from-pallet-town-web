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
  `look` (`door`, `mat`, `cave`, `ladder`, `stairs`). A building's door is the
  `door` look standing on the tile in front of the building's door cell: linking
  it is what opens the door.

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
the map, so its name is the arrival plate. A cave is also an interior
(`interiors.ts`): dimmed, and its floor rolls for wildlife on every step.

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
into the file whole. A building's **GO INSIDE** makes its inside from the
FireRed room that building is and links its door. A passage between two places
is two clicks - the entrance, then where it comes out - drawn as a line between
its ends.

## Shipping order

1. Data model and doors: areas, links, building insides dressed in the FireRed
   room art the base already ships, the switcher, the checks.
2. Interiors: more FireRed rooms and furniture cut from pret's FireRed tilesets.
3. Caves: FireRed cave art from pret, cave mouths on rock, ladders, cave
   wildlife, the passage tool.
4. Warps: gatehouses and the Underground Path - a door that comes out somewhere
   else on the map.
