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

## One hunter for the room

| | |
|---|---|
| `h1-amy-keeps-the-hunter.png` | AMY's browser keeps the hunter (the lowest id on the map): it arrives and chases whoever is nearest. |
| `h2-olly-sees-the-same-hunter.png` | OLLY's screen at the same moment: the same rival on the same tile, drawn from what AMY's browser says. He has no hunter of his own. |
| `h3-olly-fights-the-hunter.png` | OLLY walked into it: the fight is his, in his own tab, against a team that mirrors his party. |
| `h4-amy-hunter-held.png` | Meanwhile on AMY's screen the hunter holds where it caught him, however she walks. |
| `h5-amy-after-the-escape.png` | OLLY ran: the hunter fell back and searches, on both screens, from OLLY's word on where his escape left it. |

`node tools/playtest/friendHunter.mjs <url> <dir>` plays it (the driver skips the arrival's wait).

## Loot to whoever steps on it first

| | |
|---|---|
| `l1-olly-picks-it-up.png` | Both raids lay the room's 25 shared pieces on the same tiles. OLLY walks onto the lockpick, the database says he was first, and it goes into his pack. |
| `l2-amy-sees-it-gone.png` | On AMY's screen the lockpick is gone from that tile the moment he takes it. |

`node tools/playtest/friendLoot.mjs <url> <dir>` plays it.

## Quick phrases and a ping

| | |
|---|---|
| `t1-amy-phrase-list.png` | AMY pressed T: the six phrases, by number, under the friend chip. Nothing is typed, so there is nothing to filter. |
| `t2-olly-hears-amy.png` | She pressed 2: OLLY reads HUNTER COMING! on her name plate and on his chip. |
| `t3-olly-sees-the-ping.png` | She walked two tiles and pressed G: a ring on the tile she pinged, and OLLY's chip pointing at it (`AMY PING W 2`). The plate stands above the trees, so a friend's name is never under a crown. |

`node tools/playtest/friendTalk.mjs <url> <dir>` plays it.

## Shared discoveries and a boss's doors

| | |
|---|---|
| `b1-amy-door-opened-by-olly.png` | OLLY beat Tollman Briggs: in AMY's raid the keeper has stepped aside and TOLL BRIDGE and ORCHARD FORD stand open, her chip says `OLLY BEAT TOLLMAN BRIGGS`, and nothing of it is in her save - the win is his. |

The ground a friend walks joins this raid's survey, so the drop-in map lights up where the whole room went. `node tools/playtest/friendBoss.mjs <url> <dir>` plays both (the driver hands OLLY the win: a level-5 partner beats no keeper).

All but the first are two tabs of one test-mode build talking over the local
stand-in, never the live project:
`node tools/playtest/friendRaid.mjs <url> <dir>`.
