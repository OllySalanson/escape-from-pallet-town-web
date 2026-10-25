# The harbour has people and Pokemon in it

Round 2 of "the badass harbour". After the waterfront (`../harbour-waterfront/`), the harbour was
still empty: the keepers are indoors, so the only figures outside were you, your partner and the
Day-Care man.

## What changed

- **Eight townspeople, each standing where their job is** (`src/game/base/harbourLife.ts`): a
  SAILOR by the Seagallop, a GYM GUIDE outside the Raid Arena ("Yo! Champ in the making!"), the
  S.S. Anne's CAPTAIN on the long pier, a DOCK WORKER at the warehouses, an ANGLER on the cove's
  jetty, a LITTLE GIRL on the beach, an OLD MAN by the bench on the green and a POLICEMAN on the
  yard.
- **Ten Pokemon about the town**, walking in HeartGold's own following art (cut by
  `scripts/cut-hgss-followers.mjs` into `public/assets/harbour-pokemon/`): Slowpoke staring at the
  sea, the policeman's Growlithe, the worker's Machop, Meowth by the crates, Pidgey on the green,
  Krabby and Psyduck on the beach - and Lapras, Tentacool and Magikarp out in the water, drawn sunk
  to the waterline.
- Everybody keeps a little beat - drifting a tile or two, looking about - and stands still while
  anything is being read. Face one and the hint says who they are; press Space and a person turns
  to look at you and talks, a Pokemon cries and does something.
- Nobody is in the way: with every one of them standing on every tile of their beat at once, every
  door, sign and landmark is still reached and read, and **no walk to a door is one step longer**
  (`harbourLife.test.ts`). A caption never sits across a person.

## How to use it

Walk the harbour and talk to whoever you meet: the hint line names whoever you are facing. The
sailor is beside the jetty you land on, the Gym Guide outside the Arena, the captain on the long
pier, and the cove past the warehouses has the angler, the girl, the Krabby and the Psyduck.
