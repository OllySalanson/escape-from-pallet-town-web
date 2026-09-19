# tools

Command-line tools that are not part of the game bundle. They are plain Node
(`.mjs`) where they only touch files, and `.mts` run through `vite-node` where
they need to import the game's own source - which is the point: a tool that
re-implements what the game does can disagree with it, and this one cannot.

- `tileset/` - reading a tile sheet, and drawing what the game draws. See
  `docs/tilesets/README.md`.
