# Asset provenance

Every file shipped under `public/assets/` was carried over from Olly Salanson's
own Unity project,
[`OllySalanson/escapeFromPalletTown`](https://github.com/OllySalanson/escapeFromPalletTown).
Except where noted below, each file is byte-identical to the upstream path
listed and is Olly's own work.

## Overworld

- `Overworld.png` - town and route decoration sheet, from
  `Assets/Art/gfx/Overworld.png`. Not currently loaded by the web client.
- `tileset.png` - the classic ground tileset (`classicTiles`), from
  `Assets/Art/gfx/tileset.png`.
- `character.png` - the walk and attack sheet every overworld figure is drawn
  from, from `Assets/Art/gfx/character.png`.

## Battle

- `battle/hud-box.png` - HUD panel, from `Assets/Art/Battle/hud-box.png`.
- `battle/dialog-plain.png` - dialogue panel, from
  `Assets/Art/Battle/dialog-plain.png`.
- `battle/background-grass.png` - the grassland battle backdrop, cropped for
  this port from `Assets/Art/Battle/Battle Backgrounds.png`. Not original art:
  that montage sheet carries an attribution painted into the image reading
  "Pokémon Platinum Battle Backgrounds, ripped by Professor Valley, for use
  only at The Spriters Resource and Pokemon Valley".
- `battle/orange-kid.ttf` - the UI typeface, from
  `Assets/Art/Battle/Orange kid.ttf`.
  Not original art: its embedded metadata names it Orange Kid by Ray Larabie,
  (c) 1999-2009 Larabie Fonts.

## Species sprites

`pokemon/front/<dexId>.png` and `pokemon/back/<dexId>.png` for dex IDs 1
(Bulbasaur), 4 (Charmander), 7 (Squirtle), 12 (Butterfree), 16 (Pidgey), 25
(Pikachu) and 39 (Jigglypuff), from `Assets/Art/Pokemons/Front/<dexId>.png` and
`Assets/Art/Pokemons/Back/<dexId>.png`.
