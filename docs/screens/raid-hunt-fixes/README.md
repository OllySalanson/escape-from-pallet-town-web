# Four fixes from the overnight bug hunts (9-10 Nov 2026)

The raids hunt's faults 1, 4 and 5 and the harbour hunt's minor finding 2, each played end to end in a headless Chromium against a `VITE_EPTW_TEST_MODE=1` build served under the Pages subpath, at 800x512. The "before" pictures for 1, 4 and 5 are the hunt's own evidence from `main` at `a9cefa03`; the prize window's "before" is a build of `main` at `d297049d`. Every "after" is a build of this branch.

## 1. TRY IT, then ESC > BACK TO MAKER, then a real raid

- `1-before-frozen-over-the-pit.png`: the jump hangs over the pit for good. The save already said a raid was under way, and the reload settled it as abandoned and took the Raid pack, 3 Potions and 3 Poké Balls.
- `1-after-landed-in-the-raid.png`: the same steps on one page, and the jump lands in the raid. No page errors. Pressing TRY IT a second time no longer throws either.

The maker puts the try's raid down as it opens (`RunManager.abandonRun`, called from `MapMakerScene.create`), and `HubScene.startRun` starts the run in memory before it writes anything, so a run the manager refuses says so and costs nothing.

## 4. SPACE mashed through the result screen

- `4-before-card-opens-on-jump-in.png`: home on the rail, the next SPACE opens the rim card on JUMP IN and the one after jumps. The hunt's driver started a second raid on the fourth press.
- `4-after-card-opens-on-not-yet.png`: every card opened home from a raid, before a step is taken, starts on NOT YET. The same driver pressed SPACE 25 more times at 0.4 seconds after landing: the card opened and closed on NOT YET each time, and no raid started.

## 5. A crash, then the rim

- `5-before-refused-after-a-crash.png`: the tab crashed mid-raid (CDP `Page.crash`), and a new tab's rim refused for up to 90 seconds: "A raid is already under way in another window. Finish it there first."
- `5-after-jumps-after-a-crash.png`: the same, and the new tab's base settles the crashed raid as it opens ("The game closed before your raid at Greystone Vale was over...") and the jump goes ahead at once.

A page playing a raid now holds its Web Lock (`raidLockName`), which the browser lets go of the moment the page dies, and its pulse says so. The rim and the base ask `RaidHeartbeat.stillLiveElsewhere` before believing a fresh pulse.

## 2. A double ENTER at the prize window

- `2-before-double-enter-bought-two.png`: two quick ENTERs on the Surf Mat bought two, 400 tickets.
- `2-after-double-enter-buys-nothing.png`: the first press asks and the second lands on KEEP THEM, so nothing is spent.
- `2-after-the-question.png`: the question, across the whole list, with the cursor on KEEP THEM, as Bill's barters ask. ENTER, RIGHT, ENTER buys one.

The prize window was also played once at the plain URL at real speed, with the same result.
