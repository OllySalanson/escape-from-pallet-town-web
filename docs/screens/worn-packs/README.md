# The pack on the player's back

`every-pack.png` is every pack (nothing, Satchel, Raid pack, Ranger pack, Hauler
frame, left to right) on the classic figure, a FireRed figure and the Bicycle's
rider (top to bottom), each in four facings (rows) and the four frames of a walk
(columns), drawn by the game's own compositor:

    npx vite-node tools/look/wornPacks.mts -- every-pack.png --zoom=4

The rules are in `src/game/look/wornPack.ts`, and `tools/playtest/wornPacks.mjs` plays
them in the real game.
