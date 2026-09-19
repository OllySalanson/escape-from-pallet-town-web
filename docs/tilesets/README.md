# Reading a tileset

A tile sheet is 16x16 squares in a grid. At its own size it is unreadable, and
without the index printed on it there is no way to say which tile you mean. The
two images here are those sheets made readable - a contact sheet, in the
photographic sense - and they are the reference the catalogues in
`src/game/world/tileset/` were written against.

| Image | Sheet | Tiles |
| --- | --- | ---: |
| `overworld-contact-sheet.png` | `public/assets/Overworld.png` | 40 x 36 = 1440 slots, 1073 drawn, **1012 distinct** |
| `classic-contact-sheet.png` | `public/assets/tileset.png` | 8 x 13 = **104** |

Regenerate either, or print a sheet that is not committed here:

```sh
node tools/tileset/contactSheet.mjs public/assets/Overworld.png docs/tilesets/overworld-contact-sheet.png 4
node tools/tileset/contactSheet.mjs public/assets/tileset.png    docs/tilesets/classic-contact-sheet.png    6
```

Two more tools answer the questions that come next:

```sh
# How much of a sheet is real? Blanks, exact duplicates, and where content lives.
node tools/tileset/analyse.mjs public/assets/Overworld.png

# What does the catalogue actually draw? Every material as a patch with its
# corners, edges and one-tile runs - a wrong index is a thing you see here
# rather than a thing you find in a map three hours later.
npx vite-node tools/tileset/atlas.mts -- overworld atlas.png

# Every landmark in a catalogue, on that catalogue's own grass, with its walls
# hatched. `flood-town` is the one to look at: it is where an object from one
# sheet first stands on another sheet's ground, and where a clash between the
# two sheets' numbering shows up as a tower with a base made of sand.
npx vite-node tools/tileset/props.mts -- flood-town props.png 2

# And the maps themselves, exactly as the scene draws them.
npx vite-node tools/tileset/renderMap.mts -- all maps.png 2 --grid --content

# While drawing one: the structure numbers with coordinates, not pass or fail.
# --runs lists every over-long lane once; --clashes lists landmarks drawn over
# each other (a tree's crown eats a roof one tile away) and trunks on roads.
npx vite-node tools/tileset/mapReport.mts -- floodplain-relay --runs --clashes
```

`renderMap` reads the real `WORLD_MAPS` through the real layer builder, so what
it prints is what the game prints - of the *ground*. It draws no captions, no
watch shading, no gate barricades and no drop-in marks, and it cannot show what
a canopy hides: for those, `tools/playtest/tour.mjs` photographs the real game. Viridian Forest shipped with no forest in it
because nobody could see what they had authored; this is the fix for that.

## Why the sheets are not chopped up

One image stays one image. Chopping a sheet into 1440 files destroys the grid
relationship the whole catalogue is addressed by, costs either a build step or
1440 requests, and produces a change nobody can review. The catalogue is the
index; the contact sheet is how a person - or an agent that can see - reads it.
