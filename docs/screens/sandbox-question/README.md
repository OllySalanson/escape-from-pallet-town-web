# PLAYTEST says it is a sandbox before it starts

The overnight critic (25 Nov 2026, problem 18) pressed PLAYTEST beside NEW GAME on a
first visit and was handed a level 99 Charizard, the whole map and an eight-hour clock
without a word. Now, in a browser with no explorer run to come back to, PLAYTEST asks
first: A SANDBOX, NOT THE GAME - EXPLORE IT or BACK, the cursor on BACK, and the hint
under EXPLORE IT says LV 99 TEAM · WHOLE MAP OPEN · NOTHING COUNTS
(`ui/titleMenu.ts`, `sandboxMenu`). A browser that already holds a run is asked CARRY ON
or START A FRESH ONE as before.

- `before-and-on-playtest.png` - the title with the cursor on PLAYTEST (unchanged).
- `after-question.png` - PLAYTEST pressed: the question, cursor on BACK.
- `after-explore-it.png` - the cursor on EXPLORE IT, with its hint.

Made against a test-mode build (`?testmode=pixels`, 1200x768) on a cleared
`localStorage`: Down, Right, Space, then Up.
