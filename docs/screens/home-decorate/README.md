# Decorating THE BOLTHOLE

Your house is a Habbo room now. Press **H** anywhere in it and a cursor takes
over: pick a thing up, carry it, turn it, put it down, a tile at a time, and
everything is saved the moment it lands. What you can put down is what you have
carried home - cushions, desks, chairs, plants and mats out of Emerald's Secret
Bases, found on the raid maps - plus a doll of every kind of Pokémon your
Pokédex holds, and the house's own pot plants and table, which move now too.

All of these are real screenshots of a test-mode build at 3x, taken by
`node tools/playtest/decorate.mjs <url> <dir> [--port=N]`, which plays the whole
loop and fails if any of it breaks.

| | |
|---|---|
| `1-as-it-was.png` | A save that has never decorated: the house stands exactly as it always did. The table and the two pot plants are furniture now, put down where the house had them. |
| `2-decorating.png` | **H**. The floor shows its grid, the white square is the cursor, and what a press would pick up is framed in gold - here, the table on its rug. The panel at the top names it and where it came from; the line at the foot says what the keys do now. |
| `3-carrying.png` | The west pot plant picked up and carried across the room. Where it would land is shaded green, and the panel says it fits. |
| `4-doll-on-the-table.png` | A Pikachu doll out of the box (**Q**/**E**), held over the table. A doll or a cushion may stand on a desk or a table top. |
| `5-refused.png` | Something held over the door mat: shaded red, and the panel says why - *KEEP THE MATS CLEAR*. A refused piece stays in your hands. |
| `6-snorlax-turned.png` | With the mouse: a Surf Mat laid with a click, and the big Snorlax doll stood on it and turned with a right click. |
| `7-decorated.png` | **H** again, and the house is yours. Walk up to the Pikachu doll and it says whose it is. |
| `smallest-stage.png` | The same on the smallest screen the game supports (320x240). |

## The rules

- **Nothing may block the door.** A piece goes down only if you can still walk
  from the door to the stairs, to where you are standing, and up to everything
  in the house that answers - the telly, the badge case, the bed, the PC. Those
  four, and everything else the house is built with, stay where they are.
- **Mats and rugs lie on bare floor**; one thing may stand on each tile of
  one. **Dolls and cushions also stand on desks and the table.** Otherwise it
  is one thing a tile, and never on a door mat or a stair mat.
- **Where it came from is what you own.** The house's own pieces always; a find
  once it is in your vault; a doll once that kind is in your Pokédex. A layout
  that claims more than you own, or that no longer fits, puts the rest back in
  the box.
- **A find is loot.** It takes squares in the pack and a wipe takes it. Common
  pieces are in every map's ordinary pool; each map also has one super-rare
  piece rolled as a prize - the Glitter Mat, the Silver and Gold Shields, the
  Gorgeous Plant and the Glass Ornament.
