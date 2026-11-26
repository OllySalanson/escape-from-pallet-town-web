# THE MAP marks the trainers who still pay

`coins-on-the-map.png`: THE MAP (M) in a raid on Greystone Vale, opened near the front door. The red square with the ring is where the player stands. The two gold squares are SCOUT TAM and ORCHARDIST BEA, trainers the player has walked beside who would still pay their prize. FOWLER HUGH, also walked beside, has been paid this raid, so he has no coin. Before this change THE MAP showed only the player.

Made with a scratch driver over `tools/playtest/deploy.mjs` against `npm run dev` at `?testmode=pixels`: deploy a Lv12 Charmander, mark the tiles round the landing and round the three nearest trainers as walked (`runSession.trodden`), mark the third trainer as paid (`runSession.trainersPaid`), read past Oak's opening line, press M and shoot the close view.
