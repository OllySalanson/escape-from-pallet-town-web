# Survey stakes are explained before a survey job is dealt

The captain was offered "Line survey: read all 3 survey stakes" from his second raid,
and only heard what a survey stake was on his fifth, from the Gym Guide outside THE
RAID ARENA.

**Before** (main at `f144d062`): one raid in, the board's first job is LINE SURVEY,
and the Gym Guide has no "!" - he only reads the job out ("Read all 3 survey stakes in
Greystone Vale."), which never says what a stake is.

**After**: one raid in, the board deals a Sealed dispatch and an Outpost resupply,
and the Gym Guide wears the harbour's "!" (`after-1-gym-guide-mark.png`). Spoken to,
he says what a survey stake is (`after-2-gym-guide-stakes.png`), his "!" goes, and
the board deals LINE SURVEY from then on.

Made with `tools/playtest/harbourFavours.mjs` against the dev server
(`?testmode=pixels`, 1200x768), which also checks the board before and after:

```
"!" over, one raid in: gym-guide, quay-porter
jobs before the Gym Guide: Sealed dispatch, Outpost resupply
the Gym Guide explains: Yo, champ! Seen PROFESSOR OAK's survey stakes out in the vale? / Wooden posts he hammers in to map it. Stand on one to read it. / Read every one, then get out: that's a LINE SURVEY done. / Now you know, he'll put survey jobs on the board for you. / Today's job: LINE SURVEY. / ...
jobs after the Gym Guide: Line survey, Sealed dispatch
```
