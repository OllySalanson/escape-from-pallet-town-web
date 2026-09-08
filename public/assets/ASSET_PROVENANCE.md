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
is their own work and that this port may use it. Two files below are the noted
exceptions - they came through that project but are not the owner's own work.

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
| `battle/orange-kid.ttf` - the UI typeface | `Assets/Art/Battle/Orange kid.ttf` | `8c1b9b2a1feca5e460ff9424d18556149fc8cd7b` |

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

## Flagged: two files that are not the owner's own work

Both came through the Unity project, and neither is settled. They are recorded
here so each decision gets made deliberately rather than by omission. **Nothing
in the icon work changes either of them.**

### `battle/background-grass.png` is ripped from a commercial game

The montage sheet it was cropped from carries an attribution painted into the
image itself: *"Pokémon Platinum Battle Backgrounds, ripped by Professor Valley,
for use only at The Spriters Resource and Pokemon Valley"*. That is a commercial
game's asset, and the stated permission does not cover this repository.

### `battle/orange-kid.ttf` is a third-party typeface, licensed for desktop use

Its own name table identifies it, and the identification is not in doubt:

- Name: Orange Kid; Designer: Ray Larabie; Vendor URL: `larabiefonts.com`;
  Licence URL: the `typodermicfonts.com` licence page.
- Copyright: "(c) 1999-2009 Ray Larabie. See attached license agreement for more
  information." No such agreement is bundled here or upstream.

Typodermic's current [licence page](https://typodermicfonts.com/license/) states
that the free-font package carries a *desktop* EULA, and routes "live website
text - a browser receives a font for live, selectable text" to a separate
**webfont** licence. `src/style.css` serves this TTF through `@font-face`, which
is that case. Third-party mirrors classify the font as public domain; per the
rule at the top of this file, a mirror's classification is not evidence.
