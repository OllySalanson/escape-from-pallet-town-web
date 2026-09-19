# tools

Command-line tools that are not part of the game bundle. They are plain Node
(`.mjs`) where they only touch files, and `.mts` run through `vite-node` where
they need to import the game's own source - which is the point: a tool that
re-implements what the game does can disagree with it, and this one cannot.

- `tileset/` - reading a tile sheet, and drawing what the game draws. See
  `docs/tilesets/README.md`.
- `abilities/` - what the engine can say about an ability, and what abilities
  moved. See `abilities/README.md`.
- `playtest/` - a headless browser for one verification session, and a whole raid
  played through it. See `playtest/README.md`.
- `moves/` - how much of the 151's move list the engine can express, from a
  committed PokeAPI snapshot. See `moves/README.md`.
- `encounters/` - what a raid through each place meets, and what it costs.
- `weather/` - what weather does to a wild fight and to each hunter rung,
  measured over the real engine. See `weather/README.md`.
