# A raid out in another window, said on the rim card

Two tabs on one save in the machine's headless Chromium, test-mode builds
(`?testmode=1`), 960x600. Tab A deployed a raid and was left running; tab B
pressed CONTINUE, walked into THE RAID ARENA and looked down from the rim.

- `before.png`: main at 4fe41b69. The card is the usual one, JUMP IN ready;
  only pressing it said "A raid is already under way in another window."
- `after.png`: the card is headed with that line in red. JUMP IN stays live:
  a crashed window leaves a pulse too, and the press asks the browser whether
  that window is still there (`HubScene.askWhetherLiveElsewhere`).
