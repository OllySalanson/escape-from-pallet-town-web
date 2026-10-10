# Growing a map by drawing past its edge

`tools/playtest/makerGrow.mjs` against a test-mode build, 1280x800.

- `before-the-edge.png`: `main`. Round the map is the window's backdrop; a
  stroke dragged off the map stops at its edge.
- `after-1-room-round-the-map.png`: the room the map may still grow into is
  ruled a tile at a time round it.
- `after-2-grown-west.png`: a sand stroke dragged off the west edge. The map
  grew four tiles west (two at a time, so every tree keeps its cut), with a
  whole tree of wood past the sand, and the window held still on what it
  showed: the drop-in is on the same screen pixel.
- `after-3-grown-three-ways.png`: then a box of water dragged past the
  south-east corner and a house planted past the top.
- `after-4-held-past-the-window.png`: a stroke held past the window's right
  edge: the window glides on and the map grows as it goes, 40 to 109 tiles
  wide in two and a half seconds.
