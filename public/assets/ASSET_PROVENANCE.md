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

### `battle/pokedollar.ttf` - the one glyph Orange Kid lacks

Orange Kid has no Pokedollar sign (U+20BD), so this is a one-glyph TrueType face
drawn here by `scripts/draw-pokedollar-glyph.mjs` and joined to the Orange Kid
family for that character alone by `unicode-range` in `src/style.css`. The
glyph is Orange Kid's own P, cell for cell on its grid, with the stem moved in a
cell and two bars through it, and the vertical metrics are copied from Orange
Kid's tables; the file is written by hand in the script, so it is byte-stable and
has no other source. **Licence: CC0 1.0**, as the face it is drawn after is, and
its name table says so.

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

## `src/game/console/vendor/` - the house console's games, the owner's own

Not under `public/assets/`, but shipped all the same: each game the console in
the player's room plays is the owner's own work in a repository of its own,
built there and vendored here as built by `scripts/fetch-console-games.mjs` at
the commit that script names. Each folder carries the game's `LICENSE` and a
`SOURCE.json` with the repository, the commit and the module's sha256, which
`src/game/console/vendor.test.ts` reads back against the committed file.

- **`pallet-blocks/`** - [Pallet Blocks](https://github.com/OllySalanson/pallet-blocks),
  by Olly Salanson, MIT. Its module inlines the Orange Kid face (CC0, see the
  typeface section above) and synthesises every sound; it has no other assets.
  The vendored build is byte-identical to the module its GitHub Pages publishes
  at that commit.

## Pixel icons, authored for this repository

`icons/*.png` - the item, objective and raid-marker icons - were drawn for this
repository and are covered by it, except the furniture icons, which are
Emerald's own pieces shrunk (see `home-furniture.png` below). They replaced vector glyphs (a `✦` character in
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
  `extraction-open`, `extraction-locked`, `landmark-worked`, the four packs
  `satchel`, `raid-pack`, `ranger-pack` and `hauler-frame`, plus the six
  Brock materials
  `radio-valve`, `cable-coil`, `parts-crate`, `lamp-oil`, `mooring-rope` and
  `linen-roll`, the held items `leftovers`, `focus-band`, `life-orb`,
  `quick-claw`, `never-melt-ice`, `charcoal` and `spell-tag`, the five evolution stones `thunder-stone`, `fire-stone`,
  `water-stone`, `leaf-stone` and `moon-stone`, `money`, the Pokedollars,
  the seven berries `oran-berry`, `sitrus-berry`, `pecha-berry`, `cheri-berry`,
  `rawst-berry`, `chesto-berry` and `aspear-berry`, the `pickaxe` and the
  `rubble` a buried exit is drawn as, the two fishing rods `old-rod` and
  `good-rod`, the `lockpick`, the five keys `weir-key`, `paddock-key`,
  `forester-key`, `garden-key` and `market-key`, the `card-key`, and the `locked-gate` and
  `locked-crate` a keyed exit and a locked cache are drawn as, and the
  `bicycle`.
  The materials are
  drawn in code by `scripts/draw-material-icons.mjs` and the held items by
  `scripts/draw-gear-icons.mjs` (character art and small shapes on the same
  palette, written out as PNG), so they are original to this repository and can
  be regenerated byte for byte; the `never-melt-ice` among them is redrawn at
  16x16 after FireRed's own 24x24 icon and coloured from its palette
  (`graphics/items/icon_palettes/never_melt_ice.pal` in pret/pokefirered at
  `037335f`), original drawing in FireRed's colours, and the `charcoal` and the
  `spell-tag` the same way after FireRed's own icons and `charcoal.pal` and
  `spell_tag.pal`. The five stones are drawn the
  same way by `scripts/draw-evolution-stone-icons.mjs`: one cut stone lit from
  the top left, five times, each in its own shade/base/light triple with its own
  mark cut out of it in the shared outline colour rather than added in a second
  hue - a bolt in yellow (`#b0781c`, `#f0b830`, `#ffe078`, chosen to stand beside
  the set's existing red and blue ones), a flame in orange (`#a02c14`, `#ec5a24`,
  `#ffa864`), a drop in blue (`#14548c`, `#2c94dc`, `#84d8f8`), a leaf in green
  (`#1c7434`, `#44b848`, `#9ce87c`) and a crescent in violet (`#443c6c`,
  `#7c74ac`, `#c4bce4`). The Thunder Stone's own rows are unchanged, so its file
  is byte-identical to the one that shipped.
  `money` is `scripts/draw-money-icon.mjs`: two pale sheets offset behind each
  other with the Pokedollar sign (a P with two bars) printed on the face, in a
  bleached green (`#9aa77e`, `#cfd8b6`, `#e8eed2`) and one warm ink
  (`#9c5b3a`). Flat and square-cornered on purpose - every shaded, rounded draft
  of it read as a tin or a jar, which is what every other icon in the Other
  pocket already is. It was `scrip.png`, with a plain seal where the sign is,
  until the money became the Pokedollar on 2026-09-23.
  The ten machines - `tm09-bullet-seed`, `tm13-ice-beam`, `tm23-iron-tail`,
  `tm28-dig`, `tm39-rock-tomb`, `tm40-aerial-ace`, `hm01-cut`, `hm03-surf`,
  `hm04-strength` and `hm06-rock-smash` - are `scripts/draw-machine-icons.mjs`:
  **one disc shape drawn ten times**, lit from the top left, in the type colour
  of the move each teaches (Grass, Ice, Steel, Ground, Rock, Flying, Normal,
  Water, Normal and Fighting; Rock is a khaki, `#756a2a`, `#b3a03c`, `#e2d68e`,
  kept clear of Dig's brown), because that is how these games have always told one disc from
  another; Strength is Normal like Cut, so it is a warmer grey (`#8c6f5a`,
  `#c9a488`, `#efd6bf`) and the two never draw as one picture. An HM's centre
  is a slot rather than the TM's pinhole, so the four machines that are never
  used up do not read as the same object as the six that are; the eight that
  shipped before HM04, and the nine before TM39, are byte-identical.
  The four errand things - `oaks-parcel`, `medicine-bag`, `brocks-crate` and
  `old-amber` - are `scripts/draw-errand-icons.mjs`, character art on the set's
  own outline in palettes of their own: brown paper and white string with a
  red-stamped label, a white doctor's bag with a red cross, steel-banded planks
  with a grey stone on their face, and a lump of amber (`#f6c45a`, `#e8962e`,
  `#b5641b`) with something dark (`#4a2a14`) inside. Original to this
  repository; the names are FireRed's where FireRed has the thing (OAK'S
  PARCEL, OLD AMBER), the drawings are not.
  The seven berries are `scripts/draw-berry-icons.mjs`: each redrawn by hand at
  16x16 after FireRed's own 24x24 berry icon, because about twenty pixels of
  fruit will not go into sixteen without resampling, and coloured with that
  icon's own palette (`graphics/items/icon_palettes/<berry>_berry.pal` in
  pret/pokefirered at `037335f`), so what ships is original drawing in
  FireRed's colours rather than a cut of its pixels. The `pickaxe` (steel on a
  wooden haft) and the `rubble` (a heap of warm grey stones, a colour of its own
  so it never reads as FireRed's Rock Smash rock) are
  `scripts/draw-dig-icons.mjs`, on the set's own palette. The `old-rod` and
  `good-rod` are `scripts/draw-rod-icons.mjs`: one rod drawn twice with its
  line hanging from the tip, told apart the way FireRed tells its rods apart -
  plain cane (`#d9b46a`, `#9c7438`) with a steel reel, and blue (`#7fb4e0`,
  `#3f6f9d`) with a red one (`#c8443c`, `#ff8a70`).
  The `bicycle` is `scripts/draw-bicycle-icon.mjs`: drawn by hand at 16x16,
  side on, because FireRed's own bag icon is 24x24 and will not go into the set
  without resampling, and coloured from that icon's palette
  (`graphics/items/icon_palettes/bicycle.pal` in pret/pokefirered at
  `037335f`): the dusky red frame `#b46262` with its pale highlight `#f6acac`,
  grey rims `#b4b4b4` and hubs `#626262`. Original drawing in FireRed's
  colours, not a cut of its pixels.
  The `lockpick`, the five keys, the `card-key`, the `locked-gate` and the `locked-crate` are
  `scripts/draw-lock-icons.mjs`, on the set's own palette: a hooked steel pick
  on a bound violet grip; **one brass key drawn five times** (`#f1d27a`,
  `#c79a3a`, `#8a6420`) with its bow in a colour of its own - blue, tan, green,
  pink and red - so five keys in one vault are five things; the `card-key`, a
  white plastic card with a blue stripe (`#3f5f8f`) and the padlock's brass for
  its chip, after FireRed's own Card Key rather than cut from it; and a plank gate
  between posts and an iron-bound crate, each carrying the same brass padlock
  (`#f1c84a`, `#b8862a`, steel shackle `#97a3b2`) so a lock reads as a lock
  wherever it is drawn. Original to this repository; `--preview=` writes the
  set side by side at eight times its size.
  The four packs - `satchel`, `raid-pack`, `ranger-pack` and `hauler-frame` - are
  `scripts/draw-pack-icons.mjs`: **one silhouette drawn four times**, each a
  little taller and a little more built than the last, in oilcloth
  (`#5b4e39`, `#7a6a4f`, `#9c8a68`), canvas (`#3a5c44`, `#4f7d5c`, `#6fa37c`),
  ranger blue (`#2d5069`, `#3f6f8d`, `#5f97b6`) and steel (`#454c58`, `#6d7684`,
  `#9aa4b2`), over one shared strap and buckle brown. Which pack you are wearing
  is the decision the loadout screen exists to ask, so the four have to be
  legible against each other at 16px and without reading the word beside them.
  `landmark-worked` is `scripts/draw-worked-landmark-icon.mjs`: the same mast
  `radio-mast` draws, with the one difference a player has to read at 16px and
  at a glance - the beacon lit green (`#9be27a`, the colour a door you opened is
  already drawn in) with the signal coming off both sides of it, instead of one
  dark red lamp and a broken pair of arcs.

### Third-party packs considered and not used

Kenney's [Roguelike/RPG pack](https://kenney.nl/assets/roguelike-rpg-pack) was
downloaded and its licence confirmed CC0 at source, both on the asset page and in
the `License.txt` inside the archive. It was not used: its 16x16 props are drawn
in a muted medieval palette that fights this game's bright tiles, and it has
nothing for a Poke Ball, an extraction pad or a radio mast, so half the set would
have had to be drawn anyway and the result would not have read as one set.
Nothing from it ships here.

## `characters/*.png` - RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly

The twenty-one overworld character designs are **Pokemon FireRed/LeafGreen art,
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
| `characters/prof-oak.png` | 117 |
| `characters/nurse-joy.png` | 342 (standing) |
| `characters/bill.png` | 984 |
| `characters/brock.png` | 1709 (standing) |
| `characters/blue.png` | 92 |
| `characters/misty.png` | 1734 (standing) |
| `characters/lt-surge.png` | 1759 (standing) |
| `characters/koga.png` | 1809 (standing) |
| `characters/sabrina.png` | 1834 (standing) |

The second cast - twenty-eight more classes of person, for the map maker - was
cut on 2026-10-10 by `scripts/cut-frlg-people.mjs` from **pret/pokefirered**
(commit `037335f`, the FireRed decompilation the nine named figures above were
checked against): one file per person in
`graphics/object_events/pics/people/`, in the game's own frame order, the
right-hand facing drawn as the left one mirrored exactly as the game draws it,
on the same 16x32 grid and sole line, colours left as pret's palettes write
them (which is how this sheet's came). Nothing from pret is committed; same
ruling, same rights holders.

| File | pret file |
| --- | --- |
| `characters/black-belt.png` | `black_belt.png` |
| `characters/camper.png` | `camper.png` |
| `characters/picnicker.png` | `picnicker.png` |
| `characters/fisherman.png` | `fisher.png` |
| `characters/swimmer.png` | `swimmer_m_land.png` |
| `characters/swimmer-woman.png` | `swimmer_f_land.png` |
| `characters/tuber-boy.png` | `tuber_m_land.png` |
| `characters/tuber-girl.png` | `tuber_f.png` |
| `characters/little-boy.png` | `little_boy.png` |
| `characters/little-girl.png` | `little_girl.png` |
| `characters/rocker.png` | `rocker.png` |
| `characters/channeler.png` | `channeler.png` |
| `characters/gentleman.png` | `gentleman.png` |
| `characters/rich-boy.png` | `rich_boy.png` |
| `characters/crush-girl.png` | `crush_girl.png` |
| `characters/cooltrainer-woman.png` | `cooltrainer_f.png` |
| `characters/poke-maniac.png` | `poke_maniac.png` |
| `characters/rocket-grunt.png` | `rocket_m.png` |
| `characters/rocket-grunt-woman.png` | `rocket_f.png` |
| `characters/policeman.png` | `policeman.png` |
| `characters/captain.png` | `captain.png` |
| `characters/chef.png` | `chef.png` |
| `characters/clerk.png` | `clerk.png` |
| `characters/gym-guide.png` | `gym_guy.png` |
| `characters/worker.png` | `worker_m.png` |
| `characters/worker-woman.png` | `worker_f.png` |
| `characters/man.png` | `man.png` |
| `characters/cameraman.png` | `cameraman.png` |

Seventeen of the file names describe what the figure looks like on screen. They
are this repository's labels, not a claim about what the game calls that sprite.

The last nine are the exception, and they are a claim. Professor Oak, Nurse Joy,
Bill and Brock are the base's four people (`src/game/world/characterDesigns.ts`,
kind `named`), so casting a lookalike would have been worse than no art. Which
row of an unlabelled sheet holds which person was settled against
`pret/pokefirered`, the FireRed decompilation, whose object-event graphics are
one file per character and named (`graphics/object_events/pics/people/`):
`prof_oak`, `nurse`, `bill` and `brock` were each matched frame for frame
against the sheet, and the match is exact. **Nothing was taken from the
decompilation** - it was read to identify a row and no pixel of it ships; every
byte here is cut from the sheet above by `scripts/cut-frlg-characters.mjs`, as
the other seventeen are.

The five hunters (`src/game/world/hunters.ts`) were added on 2026-09-23 on the
same terms and by the same method: Blue, Misty, Lt. Surge, Koga and Sabrina are
named people, so each row was matched frame for frame against
`pret/pokefirered`'s `blue`, `misty`, `lt_surge`, `koga` and `sabrina`
object-event graphics, and again nothing of the decompilation ships. Blue is
the rival and walks; the four gym leaders stand in their gyms all game and are
*standing* figures like the two below.

Two of the four are marked *standing*: the sheet gives them four cells, one a
facing, and no walk cycle, because the game draws them at a counter all day. The
cut repeats each cell across that facing's idle and step columns, and gives back
the one pixel the sheet draws a standing figure higher inside its cell, so all
twenty-six stand on the same sole line.

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
- **One strip added, recorded.** FireRed draws the broadleaf's crown five pixels
  taller than its 3x3 block, over the grass of the tile above it, and the cut
  took only the block - so every tree stood with the top of its crown sliced
  flat. `scripts/cut-frlg-tree-brim.mjs` lifts that strip off the same source
  sheet (the three cells above the first tree of its tree column), keeps the
  crown's own four colours and makes the grass round them transparent, and
  writes it to three cells of the cut that were empty (`FRLG_OBJECTS.TREE_BRIM`).
  Nothing is drawn: every pixel is the source's. `--check` compares the strip
  with the source again.
- **What was cut.** Eight ground materials with a complete 13-tile edge set;
  three 3x3 nine-slices (shallow water, deep water, tall grass); sixteen
  multi-tile objects (trees, a ledge run, a cliff face, a bridge, a market stall,
  a shop front, a plaza stair, boulders, crates); and fifteen single tiles.
  `src/game/world/frlgSheet.ts` names every one of them and
  `frlgSheet.test.ts` reads each coordinate back out of the PNG, so this list
  cannot drift from the file.

### `frlg-base.png` - the base's four rooms and Bill's cottage

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-tiles.png` and `characters/*.png` above: Pokemon FireRed/LeafGreen art,
rights holders Nintendo / Creatures / Game Freak, no licence from them.

- **Sources.** Five uploads to The Spriters Resource's FireRed/LeafGreen page
  (<https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/>),
  all downloaded 2026-09-24 from `https://www.spriters-resource.com/media/assets/4/<id>.png`:
  - asset **3724**, "Pokémon Center / Mart" (523x760), uploaded by **FrenchOrange** -
    the Pokémon Center room;
  - asset **3729**, "Bill's House" (250x200), contributor **Sam Webster**, whose note
    is painted into the image: *"Bill's house ripped from Fire Red by Sam Webster.
    No credit needed"* - Bill's cottage inside;
  - asset **3733**, "Rocket Warehouse" (480x464), uploaded by **FrenchOrange** -
    Brock's workshop;
  - asset **3771**, "Pallet Town" (1032x376), uploaded by **FrenchOrange** -
    Professor Oak's Lab, and the bed from the player's house upstairs;
  - asset **3862**, "Tileset 1" (1096x1090), contributor **fabnt** (*"Pokémon
    FireRed/LeafGreen buildings tileset. Ripped by fabnt. No credit needed."*) -
    the blue-roofed cottage Bill's door is in, and the corrugated-iron shed
    that is Brock's workshop from the yard.

  A "no credit needed" is the ripper's position, not a licence from the rights
  holder.
- **The publisher's terms** are the two clauses quoted under `frlg-tiles.png`
  above, and this file sits against them the same way: the game is
  non-commercial, and **none of the five source images is committed**. What ships
  is a cut: named pieces lifted out of the renders and packed onto a new 20x17
  grid that matches none of them.
- **How it was cut, and the edits made.** `scripts/cut-frlg-base.mjs` is the
  whole method: it names the source cell of every piece and writes
  `src/game/base/generated/basePieces.ts`, which is the only thing in the game
  that knows where a piece sits on the sheet. Four kinds of change are made, each
  named in the script where it is made: a floor an object was drawn on is made
  transparent where the object travels to another room (Oak's machine into
  Brock's workshop, a lab bookcase and the bed into the others); the lab
  bookcase standing in Bill's cottage has its books painted out with the
  bookcase's own back panel, so the shelves are empty; two plain wall tiles are
  put back together where the source only ever has something hung on them; and
  a door mat, which every render draws hanging half a tile off the room's foot,
  is cut from its own top edge. Some pieces are assembled a cell at a time
  from cells of the same render rather than cut as one rectangle - the Center's
  side walls, the warehouse's two side walls, and the warehouse generator,
  whose shadow cell beside the render's west wall is given the half shade its
  other two columns throw. Two 7-pixel Poké Balls, set on Joy's counter,
  are drawn by the script rather than cut.

### `frlg-home.png` - THE BOLTHOLE, the player's own house

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-tiles.png` and `characters/*.png` above: Pokemon FireRed/LeafGreen art,
rights holders Nintendo / Creatures / Game Freak, no licence from them.

- **Source.** pret/pokefirered, the community decompilation of FireRed
  (<https://github.com/pret/pokefirered>), pinned at commit `037335f` - the same
  commit the battle rules are read from. The files read are the interior
  tileset every FireRed house is drawn from, `data/tilesets/primary/building/`
  (`tiles.png`, `metatiles.bin`, `palettes/*.pal`), the player's house's own
  secondary tileset `data/tilesets/secondary/generic_building_1/`, and the two
  maps of that house, `data/layouts/PalletTown_PlayersHouse_1F|2F/map.bin`,
  fetched 2026-10-10 from `https://raw.githubusercontent.com/pret/pokefirered/037335f/`.
  The repository is a reconstruction of the game's own data, so the pixels are
  Nintendo's; nothing in it licenses them.
- **None of the source files is committed.** What ships is drawn pieces packed
  onto a new 16x13 grid that matches nothing in the source.
- **How it was drawn, and the edits.** `scripts/cut-frlg-home.mjs` is the
  whole method: every piece is named by the 16x16 metatiles FireRed's own map of
  the player's house lays it out in, and drawn the way the Game Boy Advance
  draws a metatile - four 8x8 tiles on a bottom layer and four on a top, each
  with its own palette and flips, colour 0 clear. It writes
  `src/game/base/generated/homePieces.ts`, the only thing in the game that
  knows where a piece sits on the sheet. Two edits are made: the upstairs rug is
  drawn twice more with its green palette entry swapped for the red and the blue
  FireRed's own palettes already hold, so the rug can be the colour of the
  player's starter. The door mat, which FireRed hangs half a tile across the
  foot of the room, is drawn across both rows and cut from its own top edge, as
  the base's other mats are. The front-room window is drawn twice more in the
  same way, its panes and their edges (the second palette's white and palest
  blue, on the window's own layer, above its sill) turned to dusk and to night,
  with five star pixels set on the night one.
- **Two pieces are not FireRed's**: the October jack-o'-lantern and the
  December tree are drawn by `scripts/cut-frlg-home.mjs` itself as pixel tables
  (written for this game, 2026-10-10, no source), in FireRed's outline weight
  and lit from the top left like the rest of the house.

### `frlg-kanto.png` - Kanto's own outdoor art, for Viridian City

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-tiles.png` and `characters/*.png` above: Pokemon FireRed/LeafGreen art,
rights holders Nintendo / Creatures / Game Freak, no licence from them.

- **Sources.** Six uploads to The Spriters Resource's FireRed/LeafGreen page
  (<https://www.spriters-resource.com/game_boy_advance/pokemonfireredleafgreen/>),
  all downloaded 2026-09-27 from `https://www.spriters-resource.com/media/assets/4/<id>.png`
  and all uploaded by **FrenchOrange**:
  - asset **3736**, "Route 01" (400x672) - the route conifer in every one of its
    lattice rows, the four grass tiles FireRed weaves a lawn from, and one fence run;
  - asset **3737**, "Route 02" (648x1312) - Route 2's timber posts;
  - asset **3764**, "Route 22" (1032x416) - the grey post-and-rail's uprights and
    corners;
  - asset **3769**, "Cerulean City" (1496x672) - the town paving's inner corners;
  - asset **3777**, "Viridian City" (1360x672) - the paving, the rock mound
    Diglett's Cave is cut into, the Pokemon Center, the Mart, the Gym and its sign,
    the town's houses, the Pokemon League Front Gate and the Route 2 gatehouse;
  - asset **3698**, "Overworld NPCs" (238x2967) - the same sheet the character
    designs above were cut from - gives the small tree Cut clears.

  Every one of the five map uploads is a whole FireRed map drawn out tile for
  tile, which is why they were cut from rather than a tile sheet: a map shows the
  conifer's overlap rows, the fence's corners and the paving's inner notches where
  the game itself puts them.
- **The publisher's terms** are the two clauses quoted under `frlg-tiles.png`
  above, and this file sits against them the same way: the game is
  non-commercial, and **none of the six source images is committed**. What ships
  is a cut: 57 named pieces lifted out of the renders and packed onto a new 20x25
  grid that matches none of them.
- **How it was cut, and the edits made.** `scripts/cut-frlg-kanto.mjs` is the
  whole method: it names the source cell of every piece and writes
  `src/game/world/generated/kantoPieces.ts`, the only thing in the game that
  knows where a piece sits on the sheet. Three changes are made, each named in the
  script where it is made. Every colour is read back to the five bits a channel
  the Game Boy Advance showed and written the way `frlg-tiles.png` writes it
  (`x << 3`, where these renders scale), so the two sheets meet without a seam.
  The ground behind a standing piece is made transparent - the ground tile
  sharing most pixels with the cell is the one it was painted over - on a piece's
  outer ring only, so a roof never loses a pixel it happens to share with grass.
  And on the fence and the Gym, which have no green of their own, whatever green
  that match missed is lifted too: thirteen grass specks on Route 22's east rail
  and a tuft by the Gym door, both of which showed on paving.

### `frlg-towns.png` - Kanto's town buildings and field objects, for the map maker

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-tiles.png`, `frlg-kanto.png` and `characters/*.png` above: Pokemon
FireRed/LeafGreen art, rights holders Nintendo / Creatures / Game Freak, no
licence from them. It was cut because the owner asked for "as much stuff in the
map maker as possible" (the palette board, 2026-10-10).

- **Source.** <https://github.com/pret/pokefirered>, commit `037335f` - the
  disassembly of the game, the same commit this game already reads FireRed's
  battle and move rules from. Read 2026-10-10: the general tileset and the
  tilesets of Pewter, Cerulean, Vermilion, Lavender, Celadon, Fuchsia, Saffron,
  Cinnabar and Viridian (`data/tilesets/`), those eight towns' block data and
  that of Routes 2, 5 and 7, where FireRed's gatehouses and the Underground
  Path's hut stand, and of Route 10, where the Power Plant does
  (`data/layouts/<Town>/map.bin`), and their warps (`data/maps/<Town>/map.json`,
  read for where each building's doors are and nothing drawn, together with
  each warp cell's behaviour in the tilesets' `metatile_attributes.bin`, which
  says whether FireRed fires it and how it is gone through), and seventeen of the game's field-object
  graphics (`graphics/object_events/pics/misc/` - the Rock Smash rock, the
  Strength boulder, the item ball, signs, the Gym statue, the S.S. Anne and so on). The Spriters Resource renders the first Kanto
  cut came from now answer an automated fetch with a browser challenge.
- **pret's terms.** pret publishes the disassembly's code under no licence that
  reaches the extracted graphics, which are the game's own; the repository says
  nothing that makes them anyone's but the rights holders'. So this file sits on
  the owner's ruling and nothing else, exactly as the other FireRed sheets do,
  and **nothing from pret is committed**: no tileset, palette or map file. What
  ships is a cut - 40 named buildings drawn from the towns' and routes' own
  metatiles and 17 objects' first frames, trimmed and packed onto a new 20x103
  grid that matches nothing in the source.
- **How it was cut, and the edits made.** `scripts/cut-frlg-towns.mjs` is the
  whole method, and names the town and rectangle of every piece. Each town is
  drawn from its metatiles; every colour is put on the `x << 3` footing the other
  FireRed sheets use; a town's common walkable ground (eight or more cells of
  it) is made transparent where it reaches a piece's edge, and on a building's
  outer ring the pixels matching the ground beside it are lifted, as
  `frlg-kanto.png`'s were; the 8x8 tiles of the town's own forest (the shared
  tileset's solid cells on the map's outer two rings, used twenty times or more)
  are left out of every piece, so a crown hanging over a roof comes off and the
  roof stays; specks of fewer than 48 pixels touching nothing else are swept up;
  and the cells named in a piece's `drop` - the Museum's garden ledge and sign,
  the Game Corner's two bushes, a tuft or a sign beside three Cinnabar
  buildings, the fence posts either end of a gatehouse, the sand's edge by the
  Power Plant - are left out. The Power Plant is built against a cliff whose
  bottom row its chimney caps are drawn into, so that row is cut `behind` the
  cliff: every pixel matching the cliff face drawn alone is lifted, and the
  caps are kept. A
  metatile the building itself draws solid is never counted as ground (Route 2
  has enough of one gatehouse roof marked walkable to count it otherwise). The
  cells a gatehouse is walked onto from - the ridge of its roof, its porches -
  are drawn over the path that leads to them, and every pixel in them coloured
  like the ground round the building is lifted. A gatehouse whose far side is
  drawn on the map beyond it as well has that side's doors read off that map,
  where it draws the same cell. The script writes `src/game/world/generated/townPieces.ts`, the only
  thing in the game that knows where a piece sits on the sheet and which of its
  cells are drawn.

### `raid-arena.png` - THE RAID ARENA's own front, its banners and its runner

**Derived from two files already in this repository, nothing fetched.** The
building is `frlg-towns.png`'s Saffron Gym (above, on that file's ruling: ripped
FireRed/LeafGreen art, rights holders Nintendo / Creatures / Game Freak,
accepted knowingly) and the banners are `Overworld.png`'s (ArMM1998, CC0, above);
every pixel added to them was drawn here, for this game, on 2026-10-29, because
the owner asked for the Arena to stop being a reused Gym ("where it says GYM it
can say RAID and then have a badge on the other side saying ARENA").

- **How it was made.** `scripts/draw-raid-arena.mjs` is the whole method and
  reads both sources out of the committed files, so a re-cut of either moves the
  Arena with it. On the Gym: the wall the town cut lifted as Saffron's paving is
  made solid again in its own colours; the GYM plate is redrawn taller and reads
  RAID; four small windows right of the door become a gold-rimmed badge reading
  ARENA; the emblem over the door is dyed red and the door glass lit warm; a
  lantern either side of the door, a flag at each end of the roof and a Poke Ball
  painted on it are drawn in. The Gym statue (also `frlg-towns.png`) has a Poke
  Ball on its plinth where it said GYM. The CC0 banner pair is dyed red with its
  emblem in gold. The runner is drawn from nothing. Every colour added is a
  15-bit value or one FireRed's own palette already uses.
- **Terms.** As its sources: the building and statue sit on the owner's ruling
  for `frlg-towns.png`, the banners stay CC0, and the rest is the owner's own.

### `pokemon-icons.png` - every Pokemon's party icon, for the map maker

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly**, on the same
ruling and from the same source as `frlg-towns.png` above: pret/pokefirered at
commit `037335f`, read 2026-10-10. Each of the 151 species' `icon.png` under
`graphics/pokemon/<species>/` - the two-frame 32x32 figure FireRed draws for a
Pokemon in the party menu - coloured from the three shared icon palettes in
`graphics/pokemon/icon_palettes/`, which `gMonIconPaletteIndices` in
`src/pokemon_icon.c` assigns per species. Nothing from pret is committed: what
ships is the frames, recoloured and packed in national-dex order onto a new
16x19 grid. `scripts/cut-frlg-pokemon-icons.mjs` is the whole method and writes
`src/game/pokemon/generated/pokemonIcons.ts`, which records each species' frame
and the row its feet stand on. They are the owner's ask on the palette board:
"all of the Pokémon that are in the game should be in the mapmaker", and only
those.

### `player-bike.png` - the player on FireRed's Bicycle

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly**, on the same
ruling and from the same source as `pokemon-icons.png` above: pret/pokefirered
at commit `037335f`, read 2026-10-12. One file,
`graphics/object_events/pics/people/red_bike.png` - nine 32x32 frames of the
protagonist riding, facing down, up and left, two pedal strokes each - laid on
the game's four-row walk grid (down, right, up, left; idle, stroke, idle,
stroke) with the right facing the left one mirrored, as FireRed draws it, and
every frame lifted four pixels so the wheels stand on row 27, the sole line
every walking figure stands on. Colours are pret's palette as written.
`scripts/cut-frlg-bicycle.mjs` is the whole method. Nothing from pret is
committed. It is the figure the player becomes while riding the Bicycle in a
raid (`src/game/world/bicycle.ts`), the captain's ask of 2026-10-12. The
Bicycle's bag icon is not a cut: it is `icons/bicycle.png`, drawn here (see the
pixel icons above).

### `frlg-ember.png` - a volcano's cave and its slopes' steps: FireRed's Mt. Ember

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-areas.png` below: Pokemon FireRed/LeafGreen art, rights holders
Nintendo / Creatures / Game Freak, no licence from them.

- **Source.** pret's FireRed disassembly, **pret/pokefirered**
  (<https://github.com/pret/pokefirered>), at commit
  `037335f4c725d7c9aecdac87066f2002b4bd7e14`, read 2026-10-14: the tileset
  pair FireRed loads for Mt. Ember's Ruby Path (`data/tilesets/primary/general`
  and `secondary/mt_ember` - 4bpp tile sheets, JASC palettes, metatile tables),
  named by metatile as the path's own layouts use them
  (`data/layouts/MtEmber_RubyPath_1F` and `_B3F`): its ash floor, the red rock
  round it with its faces, rim and joints, the boulders, rocks and spring that
  stand on the floor, its hole, ladder and the daylight of its way out; and the
  stone steps Mt. Ember's slopes cut through a band of rock
  (`data/layouts/MtEmber_Exterior`), which are the General tileset's own.
- **Terms.** As for `frlg-areas.png`: nothing of the checkout is committed;
  what ships is a cut - 21 named pieces on a new 8x5 grid.
- **How it was cut.** `scripts/cut-frlg-ember.mjs` is the whole method, and
  writes `src/game/world/generated/emberPieces.ts`. Colours are read back to the
  GBA's five bits a channel and written `x << 3`, and a piece is drawn from a
  metatile's bottom layer, its top layer or both, as the script names.

### `frlg-ice.png` - a cave of ice: FireRed's Icefall Cave

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-areas.png` below: Pokemon FireRed/LeafGreen art, rights holders
Nintendo / Creatures / Game Freak, no licence from them.

- **Source.** pret's FireRed disassembly, **pret/pokefirered**
  (<https://github.com/pret/pokefirered>), at commit
  `037335f4c725d7c9aecdac87066f2002b4bd7e14`, read 2026-10-13: the tileset
  pair FireRed loads for Four Island's Icefall Cave (`data/tilesets/primary/general`
  and `secondary/seafoam_islands` - 4bpp tile sheets, JASC palettes, metatile
  tables), named by metatile as the cave's own layouts use them
  (`data/layouts/FourIsland_IcefallCave_1F` and `_B1F`): its stone floor, the
  sheet of ice (the metatile whose behaviour is `MB_ICE`), the rock and snow
  round them, the snowy boulders, rock and ice crystals that stand on the
  ice, its hole and ladder, and the daylight of its way out.
- **Terms.** As for `frlg-areas.png`: nothing of the checkout is committed;
  what ships is a cut - 22 named pieces on a new 8x5 grid.
- **How it was cut.** `scripts/cut-frlg-ice.mjs` is the whole method, and
  writes `src/game/world/generated/icePieces.ts`. Colours are read back to the
  GBA's five bits a channel and written `x << 3`, and a piece is drawn from a
  metatile's bottom layer, its top layer or both, as the script names.

### `frlg-tile-anims.png` - FireRed's moving sea, surf and flowers

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-areas.png` below: Pokemon FireRed/LeafGreen art, rights holders
Nintendo / Creatures / Game Freak, no licence from them.

- **Source.** pret's FireRed disassembly, **pret/pokefirered**
  (<https://github.com/pret/pokefirered>), at commit `037335f`, read
  2026-10-25: the general tileset (`data/tilesets/primary/general` - its 4bpp
  tile sheet, JASC palettes 0-6 and `metatiles.bin`) and its three tile
  animations (`anim/water_current_landwatersedge`, `anim/sandwatersedge`,
  `anim/flower`), timed as `src/tileset_anims.c`'s `TilesetAnim_General`
  times them. Fetched file by file from `raw.githubusercontent.com`.
- **Terms.** Nothing of the checkout is committed; what ships is a cut - one
  row a cell of `frlg-tiles.png` or `frlg-kanto.png` that FireRed animates,
  its frames left to right, frame 0 being the cell as already drawn.
- **How it was cut.** `scripts/cut-frlg-tile-anims.mjs` is the whole method,
  and writes `src/game/world/generated/tileAnimations.ts`: it renders every
  general metatile that uses an animated tile, a frame per change of its
  cycle, and matches each cell of the two ground sheets against those frames
  pixel for pixel (within a ripped colour's rounding), so which cell is which
  animated metatile is read off the pictures rather than chosen. A cell cut
  with clear ground (Kanto's flowers) keeps its own outline in every frame.

### `frlg-hideout.png` - the Rocket Hideout and the Power Plant

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-areas.png` below: Pokemon FireRed/LeafGreen art, rights holders
Nintendo / Creatures / Game Freak, no licence from them.

- **Source.** pret's FireRed disassembly, **pret/pokefirered**
  (<https://github.com/pret/pokefirered>), at commit
  `037335f4c725d7c9aecdac87066f2002b4bd7e14`, read 2026-10-14: two tileset
  pairs. The Rocket Hideout's - `data/tilesets/primary/building` with
  `secondary/silph_co`'s metatiles drawn on `secondary/condominiums`' tiles and
  palettes, which is what `gTileset_SilphCo` loads (`src/data/tilesets/headers.h`)
  - named by metatile as `data/layouts/RocketHideout_B1F` to `_B4F` and
  `FiveIsland_RocketWarehouse` use them, and by pret's own labels
  (`include/constants/metatile_labels.h`) for the spinner arrows, the
  elevator door and the hideout's shutter: its floor, walls and the white
  rule round its rooms, the partitions of its maze, the four arrows and the
  stop plate, its stairs, lift and shutter, and the generator, desks, plants,
  table of plans, cabinet, sofa, consoles and crates standing in it. And the
  Power Plant's - `primary/building` with `secondary/power_plant` - named as
  `data/layouts/PowerPlant` uses them: its floor, its wall of machinery and the
  plates along a wall's crown, the girders, the generators, barrels, rubble,
  consoles, computer, grating and mat.
- **Terms.** As for `frlg-areas.png`: nothing of the checkout is committed;
  what ships is a cut - 80 named pieces on a new 16x17 grid.
- **How it was cut.** `scripts/cut-frlg-hideout.mjs` is the whole method, and
  writes `src/game/world/generated/hideoutPieces.ts`. Colours are read back to
  the GBA's five bits a channel and written `x << 3`; every piece is drawn from
  both of a metatile's layers, with FireRed's black lifted out of a border
  piece so it stands against whatever dark the game draws round a room.

### `frlg-areas.png` - the insides of a player's buildings, and its caves

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-tiles.png` and `characters/*.png` above: Pokemon FireRed/LeafGreen art,
rights holders Nintendo / Creatures / Game Freak, no licence from them.

- **Source.** pret's FireRed disassembly, **pret/pokefirered**
  (<https://github.com/pret/pokefirered>), at commit
  `c75f352304d529f6ba92d4f74b9cf8b5c3810788` - the same commit the game already
  reads FireRed's species, moves and battle rules from - read 2026-10-10. The
  pieces come from ten of the game's own places, drawn from their tilesets
  (`data/tilesets/primary/building`, `secondary/generic_building_1`,
  `secondary/generic_building_2`, `secondary/mart`,
  `secondary/underground_path`, `secondary/pokemon_tower`, and for the cave `primary/general` and
  `secondary/cave`: the 4bpp tile sheets, the JASC palettes and the metatile
  tables) and their layouts (`data/layouts/PalletTown_PlayersHouse_1F`,
  `PalletTown_PlayersHouse_2F`, `Mart`, `MtMoon_1F`, `MtMoon_B1F`,
  `Route2_Entrance`, `SaffronCity_NorthSouthEntrance`,
  `SaffronCity_EastWestEntrance`, `UndergroundPath_Entrance`,
  `UndergroundPath_NorthSouthTunnel`, `PokemonTower_1F`, `PokemonTower_3F`,
  `PokemonTower_7F`): the house
  and the Mart; Mt. Moon's floor, rock, sand, boulders, crater, dripping water,
  ladders and the daylight of its way out; and three gatehouses' floor, walls,
  windows, palms, tables, chairs, counters, runners and rugs, the doorway in
  the back wall and the mats - at the foot of the room, and let into the side
  walls of the gatehouse walked through west to east; and the Underground
  Path's entrance - its guard posts and its stairwell - and its tunnel north
  to south: every floor and wall metatile of it, cut one to a piece, and its
  stairs up at either end; and Lavender Town's Pokemon Tower (added 2026-10-13
  for Greystone Vale's Moor Chapel): every floor and wall metatile of its round
  room, its stairs up and down, its mat, its grey and gold graves and the
  statues of its top floor. The tower's pieces were cut from a checkout at
  `037335f`, whose `data/tilesets` and `data/layouts` are byte for byte the
  pinned commit's - the script checks exactly that.
- **Terms.** pret publishes no licence for the graphics it extracts: they are
  the game's own, and this file treats them exactly as it treats the other
  ripped sheets. **Nothing of the checkout is committed**: what ships is a cut -
  160 named pieces drawn out of the game's metatiles and packed onto a new 20x28
  grid that matches none of the game's own sheets.
- **How it was cut.** `scripts/cut-frlg-areas.mjs` is the whole method: it
  refuses a checkout whose tilesets or layouts are not the pinned commit's, names the room, the metatile and the
  layer of every piece, and writes `src/game/world/generated/areaPieces.ts`,
  the only thing in the game that knows where a piece sits on the sheet. Two
  things are done to the game's art and nothing else. Every colour is read back
  to the five bits a channel the Game Boy Advance shows and written `x << 3`, as
  `frlg-tiles.png` writes it. And a piece is drawn from one of a metatile's two
  layers or both: FireRed draws a room's furniture on the top layer, clear of
  the floor on the bottom one, so a piece cut from the top layer alone is the
  furniture with nothing round it; a door mat, which hangs half a tile off the
  foot of its room, is cropped to its own pixels and centred on one row; and
  the mats let into a gatehouse's side walls, which FireRed draws hanging over
  the dark beyond the wall, are cut whole across it with FireRed's own black -
  the dark - lifted out. The tunnel's floor and walls are cut one metatile to
  a piece, and the script also writes which piece stands at each cell of the
  tunnel (`AREA_WEAVES` in the generated module), so the game lays its floor
  and walls exactly as FireRed's own layout does. The tower is laid the same
  way, from its ground floor with the counter, the stairs and the mat taken out
  and the floor FireRed lays where they are not put back (`TOWER_PATCH`); its
  floor is cut from the bottom layer alone, under what stands on it, and the
  script writes the room's ground letters too (`AREA_WEAVE_GROUND`).

### `berry-trees.png` - the berry trees a map maker plants

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly**, on the same
ruling as `frlg-towns.png` above (the palette board, 2026-10-10: the owner chose
berry trees knowing FireRed has none). The one map maker sheet that is not
FireRed's: Pokemon Emerald's, rights holders Nintendo / Creatures / Game Freak,
no licence from them.

- **Source.** <https://github.com/pret/pokeemerald>, commit `731ad5b` - the
  disassembly of Emerald, read 2026-10-10: seven of the berry tree graphics in
  `graphics/object_events/pics/berry_trees/` (Oran, Sitrus, Pecha, Cheri,
  Rawst, Chesto and Aspear - the berries this game has as items), the four NPC
  palettes in `graphics/object_events/palettes/`, and
  `src/data/object_events/berry_tree_graphics_tables.h`, whose
  `gBerryTreePaletteSlotTable_<Berry>` names the palette each tree is drawn in.
- **pret's terms.** As for `frlg-towns.png`: nothing in the repository makes
  the extracted graphics anyone's but the rights holders', so this sits on the
  owner's ruling alone, and **nothing from pret is committed**.
- **How it was cut.** `scripts/cut-emerald-berry-trees.mjs` is the whole method:
  each tree's six 16x32 frames (grown, flowering, ripe; two of each), coloured
  from the palette its own table names for the grown stages, one berry a row on
  a new 96x224 sheet. It writes `src/game/world/generated/berryTrees.ts`, the
  order the rows are in. They are the same generation and the same overworld
  palettes FireRed's figures are drawn in, which is why they stand on its grass
  without a seam.

### `home-furniture.png` and the furniture icons - what a player arranges in THE BOLTHOLE

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly**, on the task the
owner set on 2026-10-12 ("Use FireRed's own decoration and Secret Base-style
art where it exists (dolls, cushions, plants, mats)"). FireRed has no furniture
a player moves - its houses are drawn into their maps - so all but three pieces
are Ruby/Sapphire/Emerald's Secret Base decorations: Pokemon Emerald's, rights
holders Nintendo / Creatures / Game Freak, no licence from them.

- **Source.** <https://github.com/pret/pokeemerald>, commit `731ad5b` - the
  same pinned commit `berry-trees.png` is cut from, read 2026-10-12: the Secret
  Base tilesets (`data/tilesets/primary/secret_base/` and
  `data/tilesets/secondary/secret_base/`, tiles, metatiles and palettes), the
  decoration tables that name each decoration's metatiles and shape
  (`src/data/decoration/tiles.h`, `header.h`, with the labels in
  `include/constants/metatile_labels.h`), and the doll and cushion pictures in
  `graphics/object_events/pics/dolls/` and `pics/cushions/`, each drawn in the
  NPC palette `src/data/object_events/object_event_graphics_info.h` names for it.
  Two of the dolls - Squirtle and Magnemite - are pictures Emerald carries and
  never sold.
- **The three FireRed pieces** - the house's two pot plants and its table on its
  rug - are copied off `frlg-home.png` (above), with the floor they were drawn
  standing on taken out pixel by pixel, so they can be put down on any floor.
- **The dolls of the other 138 kinds** are not on this sheet: they are drawn
  from `pokemon-icons.png` (above), FireRed's own party icons.
- **pret's terms.** As for `frlg-towns.png`: nothing in the repository makes
  the extracted graphics anyone's but the rights holders', so this sits on the
  owner's ruling alone, and **nothing from pret is committed**.
- **How it was cut.** `scripts/cut-home-furniture.mjs` (with the GBA reader it
  shares, `scripts/gba.mjs`) is the whole method: each decoration drawn from
  its own metatiles with the cave floor under it left out by tile index, each
  doll and cushion from its picture, shelf-packed onto a new 256x176 sheet. It
  writes `src/game/home/generated/furniturePieces.ts`, which is the only thing
  that knows where a piece sits on the sheet.
- **The furniture icons** - `icons/pika-cushion.png` and the twenty others
  named after a piece a raid can find - are the same pieces at 16x16, written
  by the same script: a one-tile piece is its own icon, and a bigger one is
  shrunk by a whole factor, every pixel the colour most of its block is. They
  are the one exception to "Pixel icons, authored for this repository".

### `pokemon/{front,back}/<dexId>.png` - the species sprites

- **Source.** <https://github.com/PokeAPI/sprites>, path
  `sprites/pokemon/versions/generation-iii/firered-leafgreen/` and its `back/`
  sibling. Dex IDs 1, 4, 7, 12, 16, 25 and 39, front and back, all 64x64.
  Downloaded 2026-09-19.
- **The evolved forms, from the same two directories on the same day.** Dex IDs
  2, 3, 5, 6, 8, 9, 17, 18, 26 and 40 - Ivysaur, Venusaur, Charmeleon,
  Charizard, Wartortle, Blastoise, Pidgeotto, Pidgeot, Raichu and Wigglytuff -
  front and back, all 64x64, so the whole set is one rip of one generation's art
  rather than two. Everything below applies to them identically.
- **The rest of Kanto's original 151, from the same two directories on the same
  day**, when the roster was imported: dex IDs 1 to 151, front and back, 302
  files, none larger than 64x64. `scripts/fetch-pokemon-sprites.mjs` is the
  download - it checks the PNG signature and the size of every file as it lands,
  which is the bound `spriteAssets.test.ts` holds the shipped set to - so the
  whole set can be refetched without anybody choosing a file by hand. It is
  still one rip of one generation's art, and everything below applies to all of
  it identically.
- **Licence - the first two lines of that repository's own `LICENCE.txt`,
  verbatim:**

  > "All image contents within are Copyright The Pokémon Company."

  > "This repository is distributed under CC0 1.0 Universal"

- **Read that as written.** The CC0 covers the repository; the repository itself
  states the images are not the maintainers' to relicense. **These are not CC0
  sprites, and this file must not describe them as such.**

### `pokemon/shiny/{front,back}/<dexId>.png` - the species sprites in their shiny colours

- **Source.** The same repository, rip and terms as the species sprites above:
  <https://github.com/PokeAPI/sprites>, paths
  `sprites/pokemon/versions/generation-iii/firered-leafgreen/shiny/` and
  `.../back/shiny/`, dex IDs 1 to 151, 302 files, none larger than 64x64,
  downloaded 2026-10-11 by `scripts/fetch-pokemon-sprites.mjs` (which fetches
  both sets and checks each file the same way). They are FireRed/LeafGreen's
  own pictures in each species' shiny palette, for the one-in-five-hundred
  wild roll in `src/game/pokemon/shiny.ts`. Everything said above about the
  licence applies to them identically: **not CC0**, copyright The Pokémon
  Company. `spriteAssets.test.ts` holds both sets to one front and one back per
  species.

### `battle/shiny-sparkle.png` and `battle/shiny-star.png` - FireRed's shiny marks

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly**, on the same
ruling and from the same source as `pokemon-icons.png` above.

- **Source.** pret/pokefirered at commit `037335f`, fetched 2026-10-11 from
  `https://raw.githubusercontent.com/pret/pokefirered/037335f/graphics/`:
  `battle_anims/sprites/gold_stars.png` (`ANIM_TAG_GOLD_STARS`, the stars
  `AnimTask_ShinySparkles` in `src/battle_anim_special.c` puts round a shiny as
  it lands) and `summary_screen/shiny_star.png` (the star
  `src/pokemon_summary_screen.c` stands beside a shiny's picture).
- **What was changed.** Indexed colour turned into RGBA from each sheet's own
  palette, index 0 left transparent; the sparkle sheet is otherwise whole
  (16x24, the star and two twinkles where the game's tile numbers find them)
  and the star is the summary sheet's second 8x8 tile, the one its animation
  shows. `scripts/cut-frlg-shiny.mjs` is the whole method. Nothing from pret is
  committed.
- **Terms.** As for `pokemon-icons.png`: pret publishes no licence for the
  graphics it extracts, and these ship on the owner's ruling alone.
- **To remove them**, delete both files: the sparkle is skipped when its
  texture is missing, and a shiny's star would want a drawn replacement in
  `style.css`.

### `followers/<species>.png` - the partner's walking art, from HeartGold/SoulSilver

FireRed/LeafGreen draws no Pokemon walking behind the player, so the one place
the partner's art could come from without anybody drawing it is the game that
does: **Pokemon HeartGold/SoulSilver's own following-Pokemon sprites**, ripped
from that commercial DS game. Rights holder: Nintendo / Creatures / Game Freak.
It ships under the same ruling as everything else in this section - the owner
accepted ripped commercial Pokemon art knowingly for this personal,
non-commercial fan game on 2026-09-19 - and is recorded here in those words.

- **Source.** The pret disassembly of the game,
  <https://github.com/pret/pokeheartgold>, pinned at commit
  `9d8b7591f09b65804da2fb2dfd56f320633e0d36` (2026-09-21) - the same project
  family this repository already reads `pret/pokefirered` from for stats,
  moves and character casting. Each sprite is one Nitro texture,
  `files/data/mmodel/mmodel/mmodel_<n>.NSBTX`, and which `<n>` is which Pokemon
  is that repository's own `include/constants/mmodel.h`:
  `MMODEL_FOLLOWER_MON_BULBASAUR` 297, `IVYSAUR` 298, `VENUSAUR` 299,
  `CHARMANDER` 301, `CHARMELEON` 302, `CHARIZARD` 303, `SQUIRTLE` 304,
  `WARTORTLE` 305, `BLASTOISE` 306. Fetched 2026-10-10.
- **Licence.** The repository states none (GitHub reports no licence), and it is
  a reconstruction of a commercial game whose art belongs to the rights holder.
  Nothing here should be read as a licence for these images.
- **How they were cut.** `scripts/cut-hgss-followers.mjs` is the whole method:
  it reads each texture's own header and dictionaries, decodes the eight 32x32
  four-bit frames with colour 0 clear, widens each 15-bit colour by `<< 3` as
  every other GBA/DS rip here is, and lays them out as one 64x128 sheet a
  species - two poses a facing, rows down, up, left, right. **Not a pixel is
  scaled, filtered, recoloured or moved**, so a frame here is the frame the game
  draws. HeartGold also has a female Venusaur (300, a seed on the flower); a
  save records no gender, so the male is the one cut, as the battle sprite is.
  The source textures are not committed; the script fetches them from the
  pinned commit.

### `harbour-pokemon/<species>.png` - the harbour's own Pokemon, from HeartGold/SoulSilver

The same art, the same source, the same ruling and the same script as
`followers/` above, cut for the Pokemon that live about THE HARBOUR
(`src/game/base/harbourLife.ts`) rather than follow anybody. By
`include/constants/mmodel.h` at the same pinned commit:
`MMODEL_FOLLOWER_MON_PIDGEY` 313, `MEOWTH` 350, `PSYDUCK` 352, `GROWLITHE` 356,
`MACHOP` 364, `TENTACOOL` 370, `SLOWPOKE` 377, `KRABBY` 396, `MAGIKARP` 427,
`LAPRAS` 429. Fetched 2026-10-25. Not a pixel scaled, filtered, recoloured or
moved; the game draws the swimmers sunk to the waterline by cropping, never by
editing the sheet.

### `harbour-bird.png` - the bird over the harbour: FireRed's Fly bird and its shadow

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly** on the same ruling
as `frlg-areas.png`: Pokemon FireRed/LeafGreen art, rights holders Nintendo /
Creatures / Game Freak, no licence from them.

- **Source.** pret/pokefirered at commit `037335f`, read 2026-10-26:
  `graphics/field_effects/pics/bird.png` (the first of its five 64x64 frames,
  the bird with nobody riding it - `sAnim_Bird_WithoutPlayer`),
  `graphics/field_effects/pics/shadow_medium.png`, and the palette FireRed
  draws the bird in, object palette 0 (`CreateFlyBirdSprite` in
  `src/field_effect.c`), `graphics/object_events/palettes/player.pal`.
  Fetched file by file from `raw.githubusercontent.com`.
- **How it was cut.** `scripts/cut-frlg-fly-bird.mjs` is the whole method:
  colour 0 clear, every other colour the palette's on the GBA's `<< 3`
  footing, nothing scaled or moved. The game draws the shadow translucent.

### `cries/<dexId>.wav` - every Pokemon's own cry, from FireRed/LeafGreen

**RIPPED FROM A COMMERCIAL POKEMON GAME, accepted knowingly.** Playtest 28 put
the cries to the owner as a call - synthesised, FireRed's own, or none - and on
2026-10-11 the owner chose FireRed's own, on the same standing as the FireRed
art accepted on 2026-09-19: a personal, non-commercial fan game, the repository
public. Rights holders Nintendo / Creatures / Game Freak; no licence from them.

- **Source.** pret/pokefirered, the community decompilation of FireRed
  (<https://github.com/pret/pokefirered>), pinned at commit `037335f` - the same
  commit the battle rules, the house and the town buildings are read from. The
  files read are `sound/direct_sound_samples/cries/<name>.wav`, one a species,
  named as PokeAPI's slug with `-` for `_` (`mr_mime`, `nidoran_f`), fetched
  2026-10-11 from
  `https://raw.githubusercontent.com/pret/pokefirered/037335f/sound/direct_sound_samples/cries/`.
  They are the game's own samples - mono, 8-bit, 10512 Hz - so the sound is
  Nintendo's; nothing in the repository licenses it.
- **What was changed.** Nothing in the sound. `scripts/fetch-frlg-cries.mjs` is
  the whole method: it keeps each file's `fmt ` and `data` chunks byte for byte
  and drops the three chunks the GBA build reads (`smpl`, `agbp`, `agbl` - loop
  and pitch data nothing here uses), and checks every file as it lands.
  `cries.test.ts` holds the shipped set to one file per dex number 1-151 and to
  that format. How the game plays one - as recorded for an ordinary cry, three
  and a half semitones lower for a faint, FireRed's own `PlayCryInternal`
  pitches - is `src/game/audio/cries.ts`, not an edit to any file.
- **Terms.** pret publishes no licence for the assets it extracts; as for
  `frlg-towns.png`, nothing in the repository makes these the maintainers' to
  license, and they ship on the owner's ruling alone. Only the 151 files the
  game plays are committed.
- **To remove them**, delete the directory: every cry has a tone stand-in
  (`standIn` in `soundEffects.ts`), so a missing file is heard as the ball's pop
  or the old falling run and nothing else changes - though `cries.test.ts`
  would need to go with it.

### If these are ever to be removed

Both entries are self-contained. `frlg-tiles.png` is loaded by `BootScene` as
`frlgTiles` and nothing draws from it yet, so deleting the file, `frlgSheet.ts`,
its test and that one loader line removes it completely. The species sprites
would need replacement art at 64x64 or smaller rather than deletion, because
`spriteAssets.test.ts` requires a front and a back for every shipped species.
