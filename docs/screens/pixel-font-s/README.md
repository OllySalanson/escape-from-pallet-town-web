# S, not 3

The player's name plate in a battle, a poisoned Squirtle, 3x and cropped twice
again. Before: `YOUR3 WATER` and `P3N`. After: `YOURS WATER` and `PSN`.

At 12px Orange Kid's `S` has an upper-left stroke under two pixels tall, and
Chromium lays it across two columns: 133/110 of 255 on its first row, 100/88 on
its second. The first row clears the ink bar (128) and the second was meant to
be kept by `inkMask`'s rule for a stroke split evenly in two - but that rule
asked for the stroke to run on past the pixel on *both* sides, and this is the
stroke's last pixel. With it gone the bowl was open on the left, which is a `3`.
14px was never affected.

The rule now keeps the end of a split stroke too, where the stroke is one pixel
thick and split the same way all along. Read glyph by glyph
(`node tools/playtest/glyphSheet.mjs <dev url> after.txt --against=before.txt`),
it changes 8 of 336 renderings, all at 12px and every one towards the face's own
outline: `S` gets matching two-pixel strokes top and bottom, `a` a closed bowl,
`w` a right stem that no longer breaks, and `%` two closed rings, filled and in
outline. A looser rule changed 198 of them.

Of the other pairs that could be confused, `5`/`S`, `0`/`O` and `8`/`B` are
distinct at both sizes. `l` and `I` are not, and cannot be: in Orange Kid both
are a plain bar the full cap height, differing only in weight, which at one
pixel is nothing.
