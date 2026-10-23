# Knocking on a door

Read the sign in THE BOLTHOLE's front garden, as you would any sign: it asks
*Select the player you want to knock on the door of.* in the ordinary text box,
and once that is read every player with a house in THE HARBOUR is listed - who
is at home first. Pick one to knock (arrows and Enter, or a click or tap). If its owner is in, they are
asked; if they say yes you are let in to look round their house: their name on
their things, their furniture where they stood it, their badges and pennants on
the walls, and them standing in it. You touch nothing of theirs, and down off
the mat takes you home to your own step. If they are out, you are told so.

| | |
|---|---|
| `knock-sign.png` | AMY reading the garden sign: the text box asks whose door. |
| `knock-list.png` | The list of players that follows, while OLLY is out in the yard: OLLY, marked OUT. Knocking says *OLLY isn't home. Try again when they are.* |
| `somebody-knocking.png` | OLLY at home, asked: *AMY is at your door.* The cursor starts on NOT NOW, so the key that was already down never lets anybody in. |
| `visiting.png` | AMY let in: OLLY's house, with OLLY standing in it. |

Taken by `node tools/playtest/knocking.mjs <url> <dir>` from two tabs of one
test-mode build talking over the local stand-in, never the live project. Every
step of a knock is the database's on the live game
(`supabase/migrations/*_knocking.sql`).
