# Healing at Nurse Joy (critic's problem 15)

A save whose only Pokémon is Charmander, today's free heal already taken, at her counter.

- `before-fainted.png` - main before this change, Charmander fainted: "Healing would take 1:00 off your next raid." (a full bar 0:25 and the revive on top, capped at 1:00). A hurt Charmander was charged too.
- `after-fainted.png` - this change, fainted: "Healing would take 0:35 off your next raid." - the revive alone.
- `after-hurt.png` - this change, hurt but standing: "Healing won't cost your next raid a second."

Made with a scratch driver over `tools/playtest/deploy.mjs` helpers (new game, edit the save's HP and `freeHealDay`, walk into the Pokémon Center, talk), `?testmode=pixels`, 1200x768.
