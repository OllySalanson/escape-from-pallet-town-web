# A trainer who paid before says so

`first-win.png`: the first win over SCOUT TAM in a raid pays FireRed's prize. `second-win.png`: the same trainer beaten again. Before this change the second win said nothing at all after the defeat line; now it says why nothing came, and where money still is.

Made with a scratch driver over `tools/playtest/deploy.mjs` against `npm run dev` at `?testmode=pixels`: deploy a Lv12 Charmander, start the nearest trainer's fight with `WorldScene.resolveTrainerChallenge`, win it, then start the same fight again and shoot each prize line.
