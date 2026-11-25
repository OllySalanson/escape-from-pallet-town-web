# AI feel: who talks formally, and the lines to look at

**The standing rule: no advice lines on a screen** - [no-advice-lines.md](no-advice-lines.md).
What a screen may say, and where teaching goes instead.

For the captain's call. Nothing here has been rewritten yet; the rewrite is the
next piece of work, once the split below is agreed.

`npm run vale` sweeps every string the game says (`.vale.ini`, `styles/Tells`,
`tools/vale/`). On 20 Nov 2026 it found:

| rule | hits | what it asks |
|---|---|---|
| `Tells.NoContraction` | 1,239 (995 lines) | "It is", "I will", "do not" where a person would contract |
| `Tells.Consolation` | 4 | the same comfort from different people |
| `Tells.Antithesis` | 4 | "a drop, not a path", ", never an upgrade" |
| stock words, stock names, em dash | 0 | none in the game |

Every uncontracted line, grouped by who says it, is in
[uncontracted-lines.md](uncontracted-lines.md) (`npm run vale -- --report=docs/ai-feel/uncontracted-lines.md`).

## Where the 995 lines are

| who | lines |
|---|---|
| Greystone Vale's people, signs and places (`tools/mapcraft/worlds/greystoneVale/`) | 304 |
| other UI and system text (menus, the raid, the result screen) | 306 |
| the retired maps' townsfolk and trainers (`world/npcs.ts`, `world/trainers.ts`) | 120 |
| the map maker | 104 |
| the harbour's keepers and people (Bill, Brock, Joy, errands, Marlow) | 76 |
| item, move and ability descriptions | 52 |
| hunters, gym leaders, secrets and legends | 33 |

## Proposed split

**Stay formal** - keep "It is", "I will", "do not":

- **MARLOW**, the old keeper of charts: sixty years over a sea chart, and he talks like it.
- **KOGA**: the ninja master is formal in FireRed too.
- **SABRINA**: cold and exact, as in FireRed.
- **Written words, not speech**: signs, notices, plaques, the harbour board.
- **Not speech at all, and not part of this pass**: menus, hint lines, item, move and ability descriptions, the map maker.

**Contract** - talk like FireRed's people do ("It's", "I'll", "don't"):

- every townsperson in Greystone Vale and the harbour;
- the keepers: OAK, NURSE JOY, BROCK, BILL;
- MISTY, LT. SURGE and BLUE, the Gym Guides, every trainer;
- children, above all.

The deadpan jokes survive it: "It is a living. It is not a good one." reads as
well as "It's a living. It's not a good one."

## The other tells, one by one

- **The same comfort from two keepers.** `src/game/hub/errands.ts:161` "Well, you
  did, and that matters more." and `:229` "You came back. That is what counts."
  (and `:295` "You came back"). Give each keeper their own way of saying it.
- **"A drop, not a path."** `src/game/world/npcs.ts:198` and `:259` say the same
  shape twice ("is a drop, not a road"), on the retired maps.
- **", never an upgrade or a heal."** `src/game/scenes/HubScene.ts:3926`: the
  designer's voice in a screen's words.
- `tools/mapcraft/worlds/greystoneVale/safariMarsh.ts:321` ("They do not say so,
  but you are still here") is a false alarm: an ordinary sentence. Every hit is a
  question for a person, never a fix to apply blind.
