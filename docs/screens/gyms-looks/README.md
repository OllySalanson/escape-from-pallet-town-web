# Looks fixes from the gyms playtest of 14 Nov 2026

- **The Lapras doll's notice** was drawn with the drowned bell's rope, a dark bollard nobody read as a notice (`before-lapras-notice-a-bollard.png`). Now only THE DROWNED BELL's summons sign is a rope (`Secret.bellRope`), and every other one is a notice board (`after-lapras-notice-a-notice.png`). Standing on its reading tile, the player's head still covers it, as with every sign read from below.
- **The partner after a gym win** stood on the beaten leader's tile, like a hat (`before-partner-on-mistys-tile.png`). Now, back from a fight, it comes to the player's side (`after-partner-beside-after-win.png`).
- **A double battle's back pictures** ended in a straight cut in mid-air (`before-double-back-pictures-cut.png`). Now they stand on the top of their plates, which are drawn over the cut (`after-double-back-pictures-on-plates.png`).
- **The arena's question over a leader on her own tile** covered her and the player (`before-arena-question-covers-both.png`). The hall's view no longer eases round to the stands while somebody is speaking, and the box keeps clear of the player too (`hallQuestionClear.test.ts`).
- **The rim's refused JUMP IN** lit up teal under the cursor (`before-rim-jump-in-lit.png`). A focused refused button now stays dim. Checked in a real browser on the build: computed fill `#d3d2a9`, soft ink (`style.test.ts`).
- **A team all fainted** heard "Nobody on your bench?" with the partner at their heel (`before-fainted-team-nobody-on-bench.png`). It now hears "Your team's all fainted! See Nurse Joy, then come back."
- **A door into tall grass** now wets the boots, as a step does (`landingWading.test.ts`).

The after pictures were made with the gyms driver from https://github.com/OllySalanson/escape-from-pallet-town-web/pull/552 (`tools/playtest/gymsSameRaid.mjs`, `LEVEL=30 TEAM=pikachu:30 MISTY_ONLY=1`, plus a step to the duck hide) against a `VITE_EPTW_TEST_MODE=pixels` build. The before pictures are the tester's.
