# THE HARBOUR, shared

Everybody who plays walks the same harbour, live. A player is seen once their
house has a name (given at THE BOLTHOLE's door, `docs/screens/house-name/`), with
that name over their head; anybody may watch. Raids are untouched and
single-player. How it works and what is trusted where: `src/game/harbour/` and
the shared-harbour entry in `AGENTS.md`.

| | |
|---|---|
| `the-green.png` | The whole harbour, eight columns wider to the east: THE GREEN past the Day-Care, a fountain, a bench, flowers and its sign, so there is somewhere to stand about that is nobody's door. Every older tile is where it was. (`tools/base/renderBase.mts -- out.png 2`) |
| `olly-sees-amy.png` | OLLY's screen: AMY standing in the yard with her name on a plate over her head. |
| `amy-sees-olly.png` | AMY's screen, after OLLY walked along the top of the yard: he arrives where he stopped. |
| `amy-in-the-lab.png` | OLLY went into Oak's Lab, left AMY's yard, and was there when she followed him in. |

The three in-game ones are two tabs of one test-mode build talking over the
local stand-in, never the live project:
`node tools/playtest/sharedHarbour.mjs <url> <dir>`.
