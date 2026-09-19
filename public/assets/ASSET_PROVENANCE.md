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
| `Overworld.png` - the wide object sheet (`overworld`), **CC0, see below** | `Assets/Art/gfx/Overworld.png` | `c03c380c04a7e234c9cb681cc84ed2e097431706` |
| `tileset.png` - the ground tileset every map is drawn on (`classicTiles`), **origin not established, see below** | `Assets/Art/gfx/tileset.png` | `05325c7e049e20c11e82256029cc7a35623a15a5` |
| `character.png` - the walk and attack sheet every overworld figure is drawn from, **CC0, see below** | `Assets/Art/gfx/character.png` | `a50ceb040f5ad2821d1b4976c19ef2a849dd8fb3` |

### `Overworld.png` and `character.png` are ArMM1998's, and they are CC0

Both came through the Unity project, and both are traced past it to their real
author. They are **byte-identical** to `gfx/Overworld.png` and `gfx/character.png`
inside the author's own `gfx.zip` download:

> **Zelda-like tilesets and sprites**, ArMM1998, OpenGameArt, 2017-02-16.
> <https://opengameart.org/content/zelda-like-tilesets-and-sprites>
> **Licence: CC0 1.0 Universal**, <https://creativecommons.org/publicdomain/zero/1.0/>.
> The submission carries no Copyright/Attribution Notice: the author left no
> requirement beyond CC0.

```
2172a3629161c3c4a8c319efa5584f77d2ec28d6bf498b1d04e3e548e7717697  Overworld.png
```

Verified by downloading the author's own distribution and comparing bytes
(`curl -sSL https://opengameart.org/sites/default/files/gfx_3.zip`, then `cmp`).
CC0 requires no attribution; the credit above is voluntary, and it is here
because it is the only thing that makes the answer legible to the next person
who asks. Corroborating detail: both PNGs carry a 2016 GIMP `tIME`/`iTXt` chunk
matching the zip's own timestamps.

**One caveat, stated rather than hidden.** A commenter on that page in 2017
suggested the pack's *trees* were too close to Zelda: Minish Cap's, the author
disagreed and identified himself, and the commenter withdrew the accusation
("I take away my accusations"). Nobody has ever substantiated it, the pack has
over 165,000 downloads in nine years with no takedown, and it is recorded here
only so it is met knowingly rather than cold.

**How it is used.** `src/game/world/tileset/pokemonGround.ts` takes ground from
`tileset.png` and objects from this sheet, and that split is not a matter of
taste. Counting exact GBA 15-bit colours (every channel divisible by 8),
`tileset.png` is 30/33 = 91% and this sheet is 15/136 = 11%; their grass sits at
hue 152 and hue 123 respectively - a different colour of green rather than a
different shade - so the two **grounds cannot meet**. Objects travel between
them perfectly well, which is not a theory: `character.png` is from this pack and
every figure in the game has stood on `tileset.png` grass since the first commit.

`docs/tilesets/overworld-contact-sheet.png` is this sheet rendered readable, and
`tools/tileset/contactSheet.mjs` regenerates it for any sheet.

**`tileset.png` is very probably not original work, and this file should say so.**
30 of its 33 colours (91%) are exact GBA 15-bit values - multiples of 8 in every
channel - which is the signature of art taken off a Game Boy Advance rather than
drawn on a PC. Its grass is `#40b080`; FireRed/LeafGreen's grass shadow is
`#40b088`, the same hue to within 2 degrees. `Overworld.png`, which is known-CC0
PC art, scores 11% on the same test. This is not proof of a specific rip - no
byte-identical source sheet was found - but "the owner's own work" above is not
a safe reading of it either. The question is live, not closed.

### Battle

| File here | Upstream path | Blob SHA |
| --- | --- | --- |
| `battle/hud-box.png` - HUD panel, no longer loaded by the web client | `Assets/Art/Battle/hud-box.png` | `9efe8d233a2ce115d0b46134443772e1aa5b0601` |
| `battle/dialog-plain.png` - dialogue panel, no longer loaded by the web client | `Assets/Art/Battle/dialog-plain.png` | `4e9eb7ddb7def477a33e4b044f6692265b4508b4` |

Neither panel texture is loaded any more. Both are 32x32 frames, and every panel
in this game is drawn at a size those frames smear at, so `src/game/ui/pixelWindow.ts`
reproduces the shape at any size instead. They are kept here because
`hud-box.png` is the authority for that shape - its border colour and its clear
corners are what `pixelWindow` is sampled from.

`battle/background-grass.png` is the one derived file, so it matches no upstream
SHA: it is a single grassland panel cropped out of the montage sheet
`Assets/Art/Battle/Battle Backgrounds.png` in `c488ea6` ("Fix battle backdrop
asset", #30).

### Species sprites - replaced, see below

The seven species sprites used to be carried over from
`Assets/Art/Pokemons/{Front,Back}/<dexId>.png` in the Unity project. **They no
longer are.** They were replaced wholesale on 2026-09-19 with the
FireRed/LeafGreen sprites from PokeAPI - see "Ripped from commercial Pokemon
titles, knowingly" below for the source and its terms.

The reason was consistency as much as coverage: the Unity sprites shipped at
three different sizes (`front/1.png` was 64x64 while `front/4.png` was 36x44 and
`front/7.png` was 37x35), because each had been cropped to its own art. The
replacements are uniformly 64x64, which is what `spriteAssets.test.ts` bounds.

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

## `characters/*.png` - RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly

The seventeen overworld character designs are **Pokemon FireRed/LeafGreen art,
ripped from the commercial game**. The rights holders are Nintendo, Creatures and
Game Freak. This is not the repository owner's work, it is not CC0, and no licence
from the rights holder covers it. It ships because the owner ruled on 2026-09-19
that ripped commercial Pokemon art is accepted knowingly for this personal,
non-commercial fan game, with FireRed/LeafGreen as the adopted art direction
(`eptw-adopt-art-direction`). It is recorded here in those words so the decision
stays visible rather than becoming an assumption.

- **Source.** The Spriters Resource, Pokemon FireRed / LeafGreen, "Overworld
  NPCs" - <https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/asset/3698/>,
  uploaded by **FrenchOrange**, 238x2967, fetched 2026-09-19 from
  `https://www.spriters-resource.com/media/assets/4/3698.png`. The two
  protagonist designs are the Red and Leaf rows of that same sheet.
- **The publisher's terms**, read at <https://www.spriters-resource.com/page/tou/>
  on 2026-09-19 and quoted exactly:
  > "Content on these sites may not be used in any commercial works. These
  > include, but are not limited to, paid games, free games with in-app purchases
  > or advertisements, monetized videos, and other websites displaying
  > advertisements. This also includes anything 100% free being published to an
  > established market place (e.g. Steam, Apple's App Store, or Google Play)."

  and:
  > "Taking content in its original format from this website and distributing it
  > elsewhere without prior consent or credit to its origin will also result in
  > contact being made with those seen fit to have it removed as this is also
  > viewed as theft."

  Those are the publisher's terms for their rips. They are not a licence from the
  rights holder, and nothing here should be read as one.
- **What that means here.** The game is non-commercial, carries no advertising
  and is on no marketplace, which is inside the first clause - and putting it on
  one would put it outside. The second clause is why **the source sheet is never
  committed**: what ships is cut and rearranged frames, credited to their origin
  in this entry. Do not add a sheet from that site in the format it was
  downloaded in.
- **How they were cut.** `scripts/cut-frlg-characters.mjs` is the whole method and
  names the source row of every design. Each 16x24 cell is keyed out of the
  sheet's orange ("used") or green ("unused") backing and placed on a 16x32 frame
  with the soles on row 27, in the rows and columns `src/game/playerFrames.ts`
  reads from `character.png`: a row each for down, right, up, left; columns idle,
  step, idle, step. Every file is 64x128 RGBA. `characterDesigns.test.ts` holds
  the file list, the size, the sole line and the absence of any backing colour.

| File | Row on the source sheet (top edge, px) |
| --- | --- |
| `characters/protagonist-red.png` | 42 |
| `characters/protagonist-leaf.png` | 67 |
| `characters/lass.png` | 192 |
| `characters/heavy-man.png` | 217 |
| `characters/scientist.png` | 242 |
| `characters/boy.png` | 267 |
| `characters/youngster.png` | 292 |
| `characters/woman.png` | 492 |
| `characters/bald-man.png` | 642 |
| `characters/old-man.png` | 725 |
| `characters/old-woman.png` | 775 |
| `characters/straw-hat.png` | 800 |
| `characters/bug-catcher.png` | 825 |
| `characters/hiker.png` | 875 |
| `characters/cooltrainer.png` | 1184 |
| `characters/beauty.png` | 1309 |
| `characters/sailor.png` | 1334 |

The file names describe what each figure looks like on screen. They are this
repository's labels, not a claim about what the game calls that sprite.

## Flagged: `tileset.png`, the sheet every map's ground is drawn from

Its origin is **not established**, and it is the file with the most exposure
because it is the one that ships in every frame of the overworld.

- It is 128x208 - 8 x 13 = 104 tiles - and it is not in ArMM1998's pack; it was
  compared against all nine files there.
- It carries a Photoshop ICC profile where the two ArMM1998 files carry GIMP
  metadata, and it arrived in the same unnamed "basic assets" Unity commit.
- **The pixels say it is GBA Pokemon-family art**: 30 of its 33 colours (91%)
  are exact GBA 15-bit values - every channel divisible by 8 - which art drawn
  on a PC essentially never is by accident, and its grass base `#40b080` differs
  from the FireRed/LeafGreen grass `#40b088` by 8 in one channel. It is not
  byte-identical to any FRLG sheet, so it is a fan set drawn in the GBA palette
  or a recolour rather than a straight rip - but it is not independent work in
  an independent style, and no licence has been found for it.

This is recorded so the decision is made deliberately rather than by omission.
Replacing it is a change to `CLASSIC_TILESET`'s tile numbers and to nothing else:
maps name materials and roles, never tiles.

## Flagged: one file that is not the owner's own work

Unlike `characters/*.png` above, which the owner has ruled on, this one came
through the Unity project and is not settled. It is recorded here so the
decision gets made deliberately rather than by omission. The typeface used to sit
beside it; that question is closed above.

### `battle/background-grass.png` is ripped from a commercial game

The montage sheet it was cropped from carries an attribution painted into the
image itself: *"Pokémon Platinum Battle Backgrounds, ripped by Professor Valley,
for use only at The Spriters Resource and Pokemon Valley"*. That is a commercial
game's asset, and the stated permission does not cover this repository.

## Ripped from commercial Pokemon titles, knowingly

The repository owner ruled on 2026-09-19 that this is a personal fan game, that
fan assets are acceptable for it, and that the repository stays public. **These
files are therefore here on purpose, and this section is what "knowingly" means:
the source and the publisher's own terms, quoted rather than summarised, so the
position can be re-read rather than remembered.**

This is not a new exposure. `tileset.png` and the previous species sprites were
already Game Boy Advance Pokemon art - the GBA renders 15-bit colour, so every
colour it can display lands on an exact multiple of 8 in 8-bit RGB, and 91% of
`tileset.png`'s 33 colours and 100% of the old sprites' do. For contrast, 11% of
`Overworld.png`'s do. That test is reproducible against any file here.

### `frlg-tiles.png` - the second overworld sheet

- **Source.** Pokemon FireRed/LeafGreen outdoor tileset, from The Spriters
  Resource: <https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/>,
  asset 3863 ("Tileset 2", 477x800), submitted by **fabnt**. Downloaded
  2026-09-19. That sheet carries the ripper's own note painted into the image:
  *"Pokémon FireRed/LeafGreen outdoor tileset. Ripped by fabnt. No credit
  needed."*
- **Rights holder.** Nintendo / Creatures / Game Freak. The ripper's "no credit
  needed" is the ripper's position, not a licence from them.
- **Licence, exactly as The Spriters Resource states it**
  (<https://www.spriters-resource.com/page/tou/>):

  > "Content on these sites may not be used in any commercial works. These
  > include, but are not limited to, paid games, free games with in-app purchases
  > or advertisements, monetized videos, and other websites displaying
  > advertisements."

  > "Taking content in its original format from this website and distributing it
  > elsewhere without prior consent or credit to its origin will also result in
  > contact being made with those seen fit to have it removed as this is also
  > viewed as theft."

- **How this repository sits against those two clauses.** The first is satisfied:
  this game is non-commercial and carries no advertising or purchases. The second
  is why **no Spriters Resource sheet is committed here in its original format.**
  `frlg-tiles.png` is a cut: the tiles this game needs, lifted individually and
  rearranged onto a new 20x31 grid that matches nothing on the source sheet. The
  source sheet is not in this repository and must not be added to it.
- **One pixel edit, recorded.** The trees, the tree column and the 1x1 bush were
  cut from a part of the source sheet where the ground under them is FireRed's
  *shaded* forest grass, `#38a898`, while every ground material and every other
  object uses the route grass `#70c8a0`. Standing one on the other drew a hard
  teal rectangle round the foot of every tree. `scripts/reground-frlg-objects.mjs`
  moves that one colour - 1415 pixels, and it appears nowhere else on the sheet -
  leaving the tree's own shadow (`#388860`) untouched. The script is idempotent
  and `--check` fails if the file ever regresses.
- **What was cut.** Eight ground materials with a complete 13-tile edge set;
  three 3x3 nine-slices (shallow water, deep water, tall grass); sixteen
  multi-tile objects (trees, a ledge run, a cliff face, a bridge, a market stall,
  a shop front, a plaza stair, boulders, crates); and fifteen single tiles.
  `src/game/world/frlgSheet.ts` names every one of them and
  `frlgSheet.test.ts` reads each coordinate back out of the PNG, so this list
  cannot drift from the file.

### `pokemon/{front,back}/<dexId>.png` - the species sprites

- **Source.** <https://github.com/PokeAPI/sprites>, path
  `sprites/pokemon/versions/generation-iii/firered-leafgreen/` and its `back/`
  sibling. Dex IDs 1, 4, 7, 12, 16, 25 and 39, front and back, all 64x64.
  Downloaded 2026-09-19.
- **Licence - the first two lines of that repository's own `LICENCE.txt`,
  verbatim:**

  > "All image contents within are Copyright The Pokémon Company."

  > "This repository is distributed under CC0 1.0 Universal"

- **Read that as written.** The CC0 covers the repository; the repository itself
  states the images are not the maintainers' to relicense. **These are not CC0
  sprites, and this file must not describe them as such.**

### If these are ever to be removed

Both entries are self-contained. `frlg-tiles.png` is loaded by `BootScene` as
`frlgTiles` and nothing draws from it yet, so deleting the file, `frlgSheet.ts`,
its test and that one loader line removes it completely. The species sprites
would need replacement art at 64x64 or smaller rather than deletion, because
`spriteAssets.test.ts` requires a front and a back for every shipped species.
