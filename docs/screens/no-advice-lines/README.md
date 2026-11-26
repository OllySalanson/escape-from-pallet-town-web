# No advice lines on a screen

The captain, 25 Nov 2026: "it's a rule that we don't have these AI advice
lines. Obviously, things that we need to tell people we do, but in a normal
game fashion, not just AI lines slapped on." The rule is
`docs/ai-feel/no-advice-lines.md`.

Each pair is `<screen>-before.png` (main) and `<screen>-after.png` (this
change), at 1280x800 against a test-mode build. `lobby` (the bench), `rack`, `locker`, `bag` and
`boutique` are `node tools/playtest/menuShots.mjs <build url> <dir>
--window=1280x800 --raid`; `friend-room` is `node adviceShots.mjs <build url>
<dir> --friend` (beside this file).

## Every line that went

| Screen | Line | Now |
|---|---|---|
| Armoury rack, under the pack | "N supplies packed. Lost on a wipe unless they are in the locker. The RAID PACK is lost on a wipe either way." | nothing; a warning still shows when there is one |
| The locker, under it | "Everything else you take is lost on a wipe." | nothing |
| The locker, the partner's row (help bar and when pressed) | "BULBASAUR is your partner, so it has a place of its own: a wipe never takes your partner, and it needs no room in THE LOCKER." | "BULBASAUR is your partner." |
| The bench, its AT BASE note | "1 hurt · treat them first" / "2 fainted · see Nurse Joy" | "1 hurt" / "2 fainted" |
| The bench, every Pokémon's help bar | "...on the bench. Your partner: a wipe never takes it." / "...on the bench. Lost on a wipe unless it is in the locker." | "Put BULBASAUR on the bench." |
| Jump-in card, first job | "More ways in open up when you bring this job home." | nothing |
| Jump-in card, a friend's room | "Your room CODE · you each raid MAP on your own clock" | "Your room CODE · MAP" |
| Oak's wall map | "No boss beaten here yet. Beat one and their sign goes up." | "No boss beaten here yet." |
| Bill's PC, a fainted Pokémon | "Fainted. Medicine cannot revive - only the Pokémon Center can, for raid time." | "Fainted." (the same words still answer a Potion pressed on it) |
| Partner swap | "...as hurt as it is now, with no supplies: a change of direction, never an upgrade or a heal." | "...as hurt as it is now, with no supplies." |
| Partner swap offer | "...in the condition X is in now - the species you settle on is the one you are re-issued after a wipe." | "...in the condition X is in now." |
| Raid pack, empty | "The pack is empty. Whatever is on the ground out there is all you have." | "The pack is empty." |
| Raid pack, partner window | "Your partner. A wipe never takes it." | the name alone, under PARTNER · COMES HOME |
| Raid party, no gear | "Nothing held, and no gear in the pack. Gear is carried by the trainers holding the gates." | "Nothing held, and no gear in the pack." |
| Field guide, no job | "No job this raid. Your loot is only safe once you get out." | "No job this raid." |
| YOUR THINGS, empty | "Storage is empty. Whatever a raid brings home is kept here." | "Storage is empty." |
| Pokédex, an unmet kind | "Not met yet. A fight with one puts its shape here." | "Not met yet." |
| Knock on a door, nobody | "Nobody else has a house yet. When somebody names theirs at their door, it is here." | "Nobody else has a house yet." |
| Oak's board, bare | "Nothing pinned up. Raid for supplies, Pokémon and whatever the vale still holds." | "Nothing pinned up." |
| Boutique, Found on raids | "Never on a shelf: legendary colours and shiny ones turn up on raids. Try them on all the same." | nothing (the shelf's heading says it) |
| Boutique, Gym honours | "Never sold: each gym leader gives theirs to whoever beats them, and everybody sees you wear it." | nothing (each card names its leader) |
| Wardrobe, foot of the list | "N more on the shelves of THE HARBOUR BOUTIQUE, on THE DOCKS, and a few that only turn up on raids." | nothing |
| Boutique and wardrobe bar | "Everything in the mirror is yours. Put it on and walk out in it." / "Try something on from the shelves: it shows in the mirror first." | nothing |
| Raid with a friend | the TOGETHER, APART box: "Up to four of you on one map, each with your own team, pack and clock. The loot goes to whoever steps on it first, one hunter chases you all, and a keeper one of you beats opens his doors for everyone. Leave by any exit alone." | gone |
| Raid with a friend, waiting | "Nobody else is in yet. Your friends type CODE under Raid with a friend." | "Nobody else is in yet." |
| Favours, someone to ask | "At OAK'S LAB. Look for the !" | "At OAK'S LAB." |
| Raid with a friend, join | "Four letters, read out by whoever made the room." | gone (the field says CODE) |
| Raid with a friend, your room | "Read this code to up to three friends. The raid is on MAP." and "Get ready at the RAID ARENA, west of the yard, as for any raid. You jump in when you are ready, not together." | gone; a guest still reads "You are in ASH's room." |
| Pokémon Jump | "Only some kinds can jump: RATTATA, ODDISH, PSYDUCK, PIKACHU and the like." under CAN'T JUMP | gone from the list (still the answer when a grounded row is pointed at) |
| Pokémon Jump, nobody | "Nobody here can jump. RATTATA, CHARMANDER, KRABBY and their like can: catch one on a raid." | "Nobody here can jump." |
| Pokémon Jump, bar | "...tickets · best N. One key jumps everyone on the ground; a team of one kind lands together." | "...tickets · best N" |
| Berry Picking, nobody | "Nobody here can pick. A DODUO stands about the vale - catch one, and it is a DODRIO at 31." | "Nobody here can pick." |
| Field-Move Course | "Choose up to 3 to go round with." | nothing (the window's note counts them) |
| Prize window | "A POKéMON goes to your boxes, furniture to THE BOLTHOLE (H there)." | gone; the daily limits stay |
| Battle Arena, cups | the cup's lesson after its rule ("...the second answer to Misty.") | the rule alone |
| Battle Arena, cups and rentals, nobody | "Nobody yet. Bring up to three who keep the rule." / "...one of each kind." | "Nobody yet." |
| Battle Arena, rentals | "Today's pair: GASTLY puts a foe to sleep; SANDSHREW digs in while it naps." | gone (the pair are tagged in the list) |
| The console, name bar | "Every game you finish goes on the Pallet Town board under this name." / "Type a name before you play: it goes on the boards beside your scores." | nothing |
| The console, naming | "On every board, for everybody who plays. Up to ten: ..." | "Up to ten: ..." |
| The console, empty board | "No scores yet. Play a game and be the first name on it." | "No scores yet." |
| Saving switched off | "Every raid is kept in the save, so the game needs one to start." | nothing (the message above it says what to do) |

## What stayed, and why

- **Facts and refusals**: counts, states, a warning about this very action
  ("Your pack is full, so a catch has nowhere to go"), "This cannot be undone".
- **A thing's own printed card**: each cabinet's payout card, Berry Picking's
  scoring, the promenade games' rule cards, Bill's standing points, the prize
  window's daily limits, a cup's rule.
- **The help bar under the cursor**, which is FireRed's description box: it
  says what the pointed-at thing is or does. The partner's line was the one
  that lectured a rule and is rewritten above.
- **A person, or the moment**: the field guide's notes are Oak's, the Game
  Corner attendant explains her cabinets, and the catch tip is said once in the
  battle box after a ball a healthy Pokémon broke out of.
- **The raid result** reports what happened, so its lines stay.
