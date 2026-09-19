# Character design evidence

Captures for the change that let an authored figure name a character design
(`src/game/world/characterDesigns.ts`). They exist so the art can be judged by
looking rather than by reading a diff, and they are safe to delete once that has
happened - nothing in the game or the build reads this folder.

Every capture is the game's own canvas in a Route 1 raid opened from the test
lab, with the Route 1 trainer (LASS JUNE, then still named RAIDER MAYA) at 16,20 cast as `lass`. Figures 1 to 5 are the same
200x130 region of the screen at 3x. The player was placed beside her from the
console rather than walked there, because every tile round her is tall grass;
facings 2 to 4 are her own turn-to-face when the player pressed the interact
key, not a frame set by hand.

The art is FireRed/LeafGreen, ripped from the commercial game - see
`public/assets/ASSET_PROVENANCE.md`.

| File | Shows |
| --- | --- |
| `0-route-1-in-game.png` | The whole screen: the Route 1 trainer as a lass, turned to face the player, with the challenge prompt up |
| `1-facing-down-authored.png` | Her authored facing, before anyone speaks to her |
| `2-facing-left.png` | Spoken to from the west |
| `3-facing-right.png` | Spoken to from the east |
| `4-facing-up-drawn-over-player.png` | Spoken to from the north: she is a row further south, so she sorts in front of the player |
| `5-player-drawn-over-her.png` | The player a row south of her, so the player sorts in front. That tile is a hedge - the player was put there only to show the sort - and the head chevron crossing her face is the existing rule that the chevron sits above every figure |
| `6-all-designs.png` | All seventeen sheets side by side at 3x on the tileset's grass green: rows are down, right, up, left; columns are idle, step, idle, step |
