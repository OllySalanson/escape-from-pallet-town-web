# Knocking on a door

Press K in your own house, or on its step outside, and THE HARBOUR's doors are
listed - who is at home first. Pick one to knock. If its owner is in, they are
asked; if they say yes you are let in to look round their house: their name on
their things, their furniture where they stood it, their badges and pennants on
the walls, and them standing in it. You touch nothing of theirs, and down off
the mat takes you home to your own step. If they are out, you are told so.

| | |
|---|---|
| `knock-list.png` | The knock screen from AMY's step while OLLY is out in the yard: his house, marked OUT. Knocking says *OLLY isn't home. Try again when they are.* |
| `somebody-knocking.png` | OLLY at home, asked: *AMY is at your door.* The cursor starts on NOT NOW, so the key that was already down never lets anybody in. |
| `visiting.png` | AMY let in: OLLY's house, with OLLY standing in it. |

Taken by `node tools/playtest/knocking.mjs <url> <dir>` from two tabs of one
test-mode build talking over the local stand-in, never the live project. Every
step of a knock is the database's on the live game
(`supabase/migrations/*_knocking.sql`).
