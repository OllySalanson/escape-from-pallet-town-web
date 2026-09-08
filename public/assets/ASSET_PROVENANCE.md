# Asset provenance

Every file under `public/assets` is listed here with where it came from and what
licence it carries. **Add the entry in the same change that adds the file.** The
alternative is what happened before this file was complete: answering "where did
this come from" required hashing shipped bytes against upstream downloads.

Provenance is recorded from the source, never inferred from a filename, a
folder, a mirror, or the fact that something is widely reused. Where a licence
could not be confirmed at the publisher, this file says so rather than guessing.

## Verifying a claim in this file

Every "byte-identical to upstream" claim below is a Git blob SHA, so it can be
re-checked without downloading the file:

```sh
git hash-object public/assets/tileset.png
gh-axi api "repos/OllySalanson/escapeFromPalletTown/git/trees/main?recursive=1"
```

The two SHAs match when the file is byte-for-byte the upstream one.

## Carried over from the Unity original

`OllySalanson/escapeFromPalletTown` is the repository owner's own Unity game and
the source of this port's art. The owner has stated that the art in that project
is their own work and that this port may use it. One file below is the noted
exception - it came through that project but is not the owner's own work.

Every file in this table is byte-for-byte identical to the upstream path named,
verified by Git blob SHA on 2026-09-08 against `main`.

### Overworld

| File here | Upstream path | Blob SHA |
| --- | --- | --- |
| `Overworld.png` - town and route decoration sheet, not currently loaded by the web client | `Assets/Art/gfx/Overworld.png` | `c03c380c04a7e234c9cb681cc84ed2e097431706` |
| `tileset.png` - the classic ground tileset (`classicTiles`) | `Assets/Art/gfx/tileset.png` | `05325c7e049e20c11e82256029cc7a35623a15a5` |
| `character.png` - the walk and attack sheet every overworld figure is drawn from | `Assets/Art/gfx/character.png` | `a50ceb040f5ad2821d1b4976c19ef2a849dd8fb3` |

### Battle

| File here | Upstream path | Blob SHA |
| --- | --- | --- |
| `battle/hud-box.png` - HUD panel | `Assets/Art/Battle/hud-box.png` | `9efe8d233a2ce115d0b46134443772e1aa5b0601` |
| `battle/dialog-plain.png` - dialogue panel | `Assets/Art/Battle/dialog-plain.png` | `4e9eb7ddb7def477a33e4b044f6692265b4508b4` |

`battle/background-grass.png` is the one derived file, so it matches no upstream
SHA: it is a single grassland panel cropped out of the montage sheet
`Assets/Art/Battle/Battle Backgrounds.png` in `c488ea6` ("Fix battle backdrop
asset", #30).

### Species sprites

`pokemon/front/<dexId>.png` and `pokemon/back/<dexId>.png` for dex IDs 1
(Bulbasaur), 4 (Charmander), 7 (Squirtle), 12 (Butterfree), 16 (Pidgey), 25
(Pikachu) and 39 (Jigglypuff), from `Assets/Art/Pokemons/Front/<dexId>.png` and
`Assets/Art/Pokemons/Back/<dexId>.png`.

| Dex | Front blob SHA | Back blob SHA |
| --- | --- | --- |
| 1 | `33c520312c0184a8e919bab2b39054b19b4ded96` | `edb3c0c99065b541b49ac8bf71f046edacadb831` |
| 4 | `97c4f28499ec2d970f4e23bb9a96dffabad2f88c` | `e800eeac4af10fbfd27ef853d2dece3d80cdc4de` |
| 7 | `349758a22bca20669a9ff802f9d4665c18283ff2` | `0fc37c8eb4e01950e49a3207b6fc4748acd46d73` |
| 12 | `6e272f86bacf283df0d5dde999579de27ccc3659` | `bfe45f28cf452d25be128f32c98da5f49b4614b4` |
| 16 | `6d6d7baf045fb39dc340827b1a96716e6974bee5` | `6228af788171e91855a6651663ea0055879b086c` |
| 25 | `dee4c3ef73fcbacc8a3878619f623f10ccbceeee` | `a4a753cf0ea66aaa547444480481edda7ff22b7e` |
| 39 | `03f9d6424620e8fed5ea3fb055c12338a612b827` | `37687a76faec875f2e115063ddb5cb1911acd4b1` |

## `battle/orange-kid.woff2` - the UI typeface, CC0 from its designer

Orange Kid is Ray Larabie's 1999 replica of the EarthBound lettering, and it is
the typeface every battle line, HUD banner and field-guide heading is set in
(`src/style.css` declares it; `BATTLE_FONT` in `BattleScene.ts` and
`.objectives-menu` both name it).

- **Shipping.** `Orange Kid.woff2`, **version 4.001**, taken byte-for-byte from
  the WOFF2 webfont package on Typodermic's own public-domain page,
  <https://typodermicfonts.com/public-domain/> (the per-font desktop download
  beside it is `/assets/downloads/cc0-fonts/orange-kid.zip`). Downloaded
  2026-09-08.
- **Licence: CC0 1.0 Universal.** Confirmed at the publisher for *this* version,
  not carried over from the previous one. The page states the collection is
  released "under the official CC0 1.0 Universal public-domain dedication, with
  no rights reserved" and that you may "embed them in software, redistribute
  them, or sell them"; the WOFF2 package is the one it routes live website text
  to. The file's own name table says the same - name ID 0 is "Released in 2024
  under CC0 license. No rights reserved." and name ID 14 is
  <https://creativecommons.org/publicdomain/zero/1.0/>. Its `fsType` is 0, where
  the old build's was 4. No attribution is required; the credit above is
  voluntary.

### What this replaces, and why the licence question is now closed

The file that shipped until 2026-09-08 was `battle/orange-kid.ttf`, version
4.000, carried over from `Assets/Art/Battle/Orange kid.ttf` in the Unity project
(blob `8c1b9b2a1feca5e460ff9424d18556149fc8cd7b`). That build predates the CC0
release: its name table still carried the 1999-2009 Larabie copyright and pointed
at Typodermic's commercial licence page, which routes live website text to a
separate **webfont** licence - and `@font-face` is exactly that case. This file
recorded that as an open question rather than guessing.

Version 4.001 answers it at the publisher rather than around it, so the question
is closed by shipping the licensed build, not by reinterpreting the old one. The
4.000 TTF is deleted.

**The swap is metrically identical, which is what made it safe.** Both builds are
1000 units/em with the same `hhea` ascender/descender (978/-222) and the same
`usWin` metrics, and neither sets `USE_TYPO_METRICS`, so the one OS/2 field that
did change (`sTypoAscender`, 778 to 599) is not a field browsers read here. All
551 codepoints the old build mapped are present in the new one with **identical
advance widths**, verified again in Chrome: `measureText().width` matches to the
float across every battle string and all 100 characters at 8, 13 and 16px. Only
the rasterisation differs, because 4.001 is CFF where 4.000 was `glyf`. This
mattered because #64 had fixed battle dialogue losing the first character of
every line; that fix is `DialogBox` padding, and identical advances mean nothing
about it moved.

## Pixel icons, authored for this repository

`icons/*.png` - the item, objective and raid-marker icons - were drawn for this
repository and are covered by it. They replaced vector glyphs (a `✦` character in
the menus, tinted rectangles on the map) that read as placeholders inside a pixel
game.

- **Format.** Every icon is a 16x16 RGBA PNG: one map tile, and a whole divisor
  of the boxes the menus draw them in, so nothing is ever resampled.
  `src/game/ui/icons.test.ts` enforces the size and the file list.
- **Palette.** One shared outline (`#241f2e`) and a shade/base/light triple per
  hue, picked to sit on both the bright overworld tiles and the dark menu
  surfaces. A replacement icon only has to match the 16x16 size; matching the
  palette is what keeps the set looking like a set.
- **Contents.** `potion`, `super-potion`, `antidote`, `poke-ball`, `great-ball`,
  `field-kit`, `supply-crate`, `supply-cache`, `radio-mast`, `sign-post`,
  `extraction-open`, `extraction-locked`.

### Third-party packs considered and not used

Kenney's [Roguelike/RPG pack](https://kenney.nl/assets/roguelike-rpg-pack) was
downloaded and its licence confirmed CC0 at source, both on the asset page and in
the `License.txt` inside the archive. It was not used: its 16x16 props are drawn
in a muted medieval palette that fights this game's bright tiles, and it has
nothing for a Poke Ball, an extraction pad or a radio mast, so half the set would
have had to be drawn anyway and the result would not have read as one set.
Nothing from it ships here.

## Flagged: one file that is not the owner's own work

It came through the Unity project and is not settled. It is recorded here so the
decision gets made deliberately rather than by omission. The typeface used to sit
beside it; that question is closed above.

### `battle/background-grass.png` is ripped from a commercial game

The montage sheet it was cropped from carries an attribution painted into the
image itself: *"Pokémon Platinum Battle Backgrounds, ripped by Professor Valley,
for use only at The Spriters Resource and Pokemon Valley"*. That is a commercial
game's asset, and the stated permission does not cover this repository.
