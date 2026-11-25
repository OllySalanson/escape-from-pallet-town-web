# Prize money for a win (critic's problems 11 and 16)

- `after-prize-line.png` - a new save's Charmander (Lv 12 for the check) beats SCOUT TAM, the Lv 3 bug catcher on Millbrook's square: "That's me beaten. Go on through." and then FireRed's line, "You got ₽36 for winning!" (4 x Lv 3 x the bug catcher's 3). The ₽36 is in the raid's pack.

Before this change the fight ended on "That's me beaten. Go on through." and paid nothing.

Made with a scratch driver over `tools/playtest/deploy.mjs` (deploy with `level: 12`, start the nearest trainer's fight with `WorldScene.resolveTrainerChallenge`, SPACE through it, screenshot the line), `?testmode=pixels`, 1200x768.
