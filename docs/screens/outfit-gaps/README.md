# Outfit gaps: the strip through the Mewtwo robe, and six more

Every picture is a piece (or a whole look, `look ...`) worn on the starter look,
in all sixteen frames: front, right, back, left, each stand-step-stand-step.
The top row of each pair is `main` before the fix, the bottom row is this
change. Magenta is a see-through pixel with the figure on all four sides of it -
the ground showing through the figure - which is what
`src/game/look/wearables.test.ts` now counts for every piece and whole look.

- `robes.png` - the Mewtwo robe, the Mewtwo look, the Channeler's robe it is
  dyed from, and the Channeler's veil, which gives the robe its grey chest back.
- `gowns.png` - Beauty's gown, the Team Rocket dress and its whole look (her red
  front had been taken for hair), Lorelei's gown.
- `dresses.png` - Daisy's dress, the Lass dress (all five colours are one piece),
  the Mew dress, the gi outfit and the long skirt.
- `heads.png` - the heads the new hair rule changed: the Rocket's hair and the
  Ace Trainer's ponytail no longer hold their dress's front, the Ace Trainer's
  suit has its violet front edge back, Beauty's waves take their own dark edge.
- `icon-mewtwo-robe.png` - the Mewtwo robe's bag icon at 12x, before and after.

Made with:

    git show <before commit>:public/assets/wearables.png > before.png
    npx vite-node tools/look/lookGaps.mts -- docs/screens/outfit-gaps/robes.png --before=before.png --ids=mewtwo-robe,look:mon-mewtwo,channeler-robe,channeler-veil
    npx vite-node tools/look/lookGaps.mts -- docs/screens/outfit-gaps/gowns.png --before=before.png --ids=beauty-gown,grunt-dress,look:team-rocket-dress,lorelei-gown
    npx vite-node tools/look/lookGaps.mts -- docs/screens/outfit-gaps/dresses.png --before=before.png --ids=daisy-dress,lass-dress,mew-dress,gi-outfit,long-skirt
    npx vite-node tools/look/lookGaps.mts -- docs/screens/outfit-gaps/heads.png --before=before.png --ids=grunt-hair,ace-tail,ace-suit,golden-waves

The before sheet is `main` at f144d062.
