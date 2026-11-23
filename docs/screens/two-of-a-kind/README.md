# Two of a kind, told apart

THE RAID ARENA's rim card at 1366x768 in the machine's headless Chromium on a
test-mode build (`?testmode=1`), a save with six on THE BENCH - Charmander and
a Pidgey Lv 6 among them - and a Pidgey Lv 4 caught on the last raid at home.
Cropped to the card's top (`ffmpeg -vf crop=1300:110:18:440`).

- `rim-before.png`: "Pidgey Lv 6, ... come. Pidgey stays home: THE BENCH chooses."
- `rim-after.png`: "... come. Pidgey Lv 4 stays home: THE BENCH chooses."

The raid's result said the same thing the same way - "Banked Pidgey and ₽25.
Pidgey, Rattata, Caterpie, Weedle, Spearow ... rode out unprotected" - and now
says "Banked Pidgey Lv 4 ... Pidgey Lv 6, Rattata, ..." (`extractionReport.test.ts`).
