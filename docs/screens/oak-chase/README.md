# Oak names the chase after both badges

`after-both-badges.png`: a save with both gym badges (Misty and Koga) and the near jobs banked, talking to Oak in his lab. Before this change his last line about what to do next was the gym, so with both gyms beaten he named nothing. Now he names the treasure map, stage by stage, and once that is done, the vale's uncaught legends, a different one each raid.

Made with a scratch driver over `tools/playtest/deploy.mjs` against `npm run dev` at `?testmode=pixels`: seed the save's `raidProgress.defeatedBosses` with both gyms, walk into Oak's Lab and talk to him, and shoot the line that starts "Next,".
