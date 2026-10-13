# Raid with a friend

One player makes a room in Oak's Lab and gets a four-letter code; up to three
friends type it and drop into the same map. Each sees the others walk, named,
and keeps their own team, pack, clock, fights and loot. A friend who leaves -
by an exit, a loss or a closed tab - is gone from the map at once and said to
have left, and the raid carries on. How it works and what is trusted where:
`src/game/raidRoom/` and the raid-room entry in `AGENTS.md`.

| | |
|---|---|
| `0-lab-card-smallest-stage.png` | Oak's Lab at the smallest stage (320x240 at 2x): RAID WITH A FRIEND is the third card. |
| `1-olly-make-a-room.png` | The screen: a room on any map this save can drop into, or a friend's code. |
| `2-olly-room-code.png` | OLLY's room, its code on the title bar's inversion, and who is in it. |
| `3-amy-joined.png` | AMY typed the code: OLLY's room, his map, and that he is already on it. |
| `4-amy-sees-olly.png` | In the raid: OLLY under his name, two tiles west, and the chip saying so (`OLLY W 2`). |
| `5-olly-sees-amy.png` | The same moment on OLLY's screen. |
| `6-amy-olly-left.png` | OLLY's tab closed: his figure is gone and AMY's chip says `OLLY LEFT THE RAID`. |

All but the first are two tabs of one test-mode build talking over the local
stand-in, never the live project:
`node tools/playtest/friendRaid.mjs <url> <dir>`.
