# THE GAME CORNER (the arcade on PIER SQUARE, door near 85,9; the PRIZE WINDOW is the room next door and is NOT yours) - score 5/10

**Verdict:** A handsome little arcade with two real, faithfully ported FireRed minigames in it, and then the house's own loaner PIKACHU walks on to the vine as a BULBASAUR. The room keeps saying things that are slightly untrue: a caption that tells you to bring a bird the counter already lends, and an attendant whose rule for tickets doesn't match how they're paid. The regulars are scenery that recites one of three canned lines, word for word, every time you speak to them. It looks like an arcade. Too often it doesn't play or talk like one.

## Problems, worst first

### 1. The house's PIKACHU jumps as a BULBASAUR  [kind: bug]
- **Seen:** New save: I chose CHARMANDER and the lent "PIKACHU Lv 10 · Normal jumper · Lent by the house", pressed PLAY, and the vine came round a CHARMANDER and a green bulb-backed BULBASAUR. Mid-game save: the PIKACHU alone (IVYSAUR and DIGLETT "CANNOT JUMP") shows up as a lone BULBASAUR. The mid-game player was told their own Bulbasaur line can't play, and then got a Bulbasaur anyway.
- **Where / repro:** GAME CORNER, stand at 1,9 facing up, SPACE, keep PIKACHU in, PLAY.
- **Screenshot:** ../shots/game-corner-01-house-pikachu-is-bulbasaur.png, ../shots/game-corner-12-mid-lone-pikachu-is-bulbasaur.png
- **Why it is bad:** The loan is the room's answer for anyone who can't play, so every newcomer and every evolved-starter player sees it. The wrong Pokémon is the first thing they see in the minigame.
- **Fix:** `src/game/scenes/GameCornerScene.ts:538` looks the jumper's dexId up in the stash and falls back to `1` (Bulbasaur). A loan isn't in the stash. Carry the dexId on the jumper, or take `HOUSE_JUMPER.dexId` (25, `src/game/minigames/houseLoans.ts:26`) for `house:pikachu`, the way `BerryPickingScene.ts:235` already does for the DODUO.

### 2. The BERRY PICKING caption tells you to bring a bird the house already lends  [kind: wrong/out-of-date]
- **Seen:** Both saves. Facing any BERRY PICKING cabinet the caption reads "BERRY PICKING / Bring a DODUO or DODRIO". One step later the cabinet's own list holds "DODUO Lv 10 · two heads, turns to reach · Lent by the house PICKING", and the attendant says "Nobody to jump or pick? I'll lend you one of ours."
- **Where / repro:** Stand at 10,9 facing up.
- **Screenshot:** ../shots/game-corner-06-berry-caption.png, ../shots/game-corner-07-berry-picker.png
- **Why it is bad:** A newcomer with no DODUO reads the caption, decides the cabinet isn't for them and walks off. The caption is the only word the cabinet says before you press SPACE.
- **Fix:** True fact: the house lends a DODUO (`src/game/minigames/houseLoans.ts:29`, `HOUSE_PICKER`). Change `src/game/minigames/gameCornerTalk.ts:64` from 'Bring a DODUO or DODRIO' to something like 'Catch the falling BERRIES for TICKETS' (to match JUMP's "Jump the vine for TICKETS"). Also `gameCornerTalk.ts:69`, "A DODRIO reaches left, up and right", describes a bird the house doesn't lend. The loan is a two-headed DODUO that "turns to reach".

### 3. The attendant's rule for tickets is wrong: it's once a day a game, not "a cabinet"  [kind: wrong/out-of-date]
- **Seen:** Both saves, every time: "Good scores win TICKETS, once a day a cabinet, to spend at the PRIZE WINDOW next door."
- **Where / repro:** Step in on the mat (7,11) and press SPACE, or stand at 5,4 and face up.
- **Screenshot:** ../shots/game-corner-03-attendant.png
- **Why it is bad:** The room has six cabinets, three of each game. "Once a day a cabinet" invites a player to farm all three POKéMON JUMP cabinets, and two of them will pay nothing. It isn't really "once" either: a better score the same day tops the pay up to the next tier. The phrasing is clumsy on top of being wrong.
- **Fix:** True fact: pay is kept per game (`'pokemon-jump'`, `'berry-picking'`), owed as `tickets(best) - day.paid[source]` (`src/game/minigames/tickets.ts:414`). It's shared by all three cabinets of a game and topped up as you beat a higher tier. Rewrite `src/game/minigames/gameCornerTalk.ts:133` as e.g. "Welcome to the GAME CORNER! Score well and each game pays TICKETS, up to a day's worth. Spend them at the PRIZE WINDOW next door."

### 4. The attendant and the regulars never say anything new  [kind: ai-feel]
- **Seen:** I talked to the attendant five times across both saves, before and after playing both games. Every time it was the same four boxes, starting "Welcome to the GAME CORNER!". The regulars across both saves had three lines between them, repeated verbatim on every talk: "Not on the JUMP board yet today. Shh - this is the one." (TESS-SWIMS four times running, SKYEZARD, 1MORERAID, DEXHUNTER, TOISE4LIFE), "Next go is mine. Watch the board." (BEEBEE22, DEXHUNTER, KARPKING) and "N at GAME so far. Not top yet." Eleven "players", three sentences.
- **Where / repro:** Talk to anyone at the cabinets twice. Leave the room and come back after two minutes to get a new crowd with the same lines.
- **Screenshot:** ../shots/game-corner-10-regulars.png
- **Why it is bad:** The room's selling point is "the regulars play here", and they come across as signposts with usernames. The attendant greets a returning player like a stranger. She has a line for players holding tickets, but the line for someone who just played and earned nothing is the full welcome again.
- **Fix:** Attendant: give the full welcome once (keyed on having ever played, `record.best`), then one short line that reacts to today, e.g. "JUMP's paid you 10 today - 2,500 gets you the next 10." Regulars (`src/game/minigames/arcade.ts:121-136`): give each line a few variants, chosen by bot and day, and let a talk cycle through them. Let one regular comment on the player's own score when they're on the board ("You're on the JUMP board. Not for long.").

### 5. SPACE on the result screen starts the next game, so a jumper never sees their result  [kind: bug]
- **Seen:** New save, several times: the vine hit ("OUCH!"), the cabinet's screen came back with "SCORED 60 / AGAIN", and the next SPACE press went straight into a new countdown ("3"). The 60 result was replaced by the next game's 0.
- **Where / repro:** Play POKéMON JUMP and keep tapping SPACE as you would to jump. When the vine catches you, tap once more.
- **Screenshot:** ../shots/game-corner-09-jump-result.png
- **Why it is bad:** SPACE is the jump key, so everyone is mashing it when the game ends. The result line ("No tickets. A score of 250 pays 10 tickets.", or a payout) is the only feedback the cabinet gives, and it's thrown away.
- **Fix:** `src/game/scenes/GameCornerScene.ts:475` refocuses `[data-play]` straight after `finish()`, and the PLAY/AGAIN handler (`:225`) has no arming guard. Either land the cursor on the result (or the first row) or gate AGAIN behind `RELEASE_ARMING_MS`, as `ask()` at `:281` already does. A guard of a second or so would be better, since a SPACE press is in flight when the game ends.

### 6. Escape during the countdown counts as a played game  [kind: bug]
- **Seen:** New save: Escape while the countdown showed "3" gave "SCORED 0 / AGAIN / No tickets. A score of 250 pays 10 tickets."
- **Where / repro:** PLAY, then Escape at once.
- **Screenshot:** ../shots/game-corner-09-jump-result.png
- **Why it is bad:** "ESC: stop" during a countdown means "I didn't mean to start". Scolding the player with a 0 is petty, and it gets written to the save (`playJump(0)`).
- **Fix:** `src/game/scenes/GameCornerScene.ts:401`: in the `countdown` phase, go back to the menu without calling `finish()`/`playJump`.

### 7. BERRY PICKING's HUD counts "EATEN" while its rules talk about berries that "land"  [kind: jargon]
- **Seen:** Both saves. The HUD reads "SCORE 0 / EATEN 0 ... MISSES LEFT". The cabinet's screen says "Blue 10, green 30, gold 50; every one that lands costs 50." I finished one game with "EATEN 5" and a score of 0. Nothing ever says that "eaten" means caught, or that "lands" means missed.
- **Where / repro:** Any BERRY PICKING game.
- **Screenshot:** ../shots/game-corner-08-berry-play.png
- **Why it is bad:** "Lands" reads as "lands in the beak". A new player watches EATEN go up and SCORE stay at 0 and can't tell why.
- **Fix:** HUD `src/game/scenes/BerryPickingScene.ts:556`: "CAUGHT". Rules `src/game/minigames/gameCornerView.ts:447`: "Blue 10, green 30, gold 50. Each one you drop costs 50."

### 8. The rate card reads like a spec sheet, and its tiers look like they add up  [kind: wall-of-text]
- **Seen:** Under every cabinet: "0 tickets · best 0 / Tickets, once a day: 250 pays 10 · 2,500 pays 20 · 6,000 pays 30. From 5,000, a BERRY too." After a game, a third copy of the same fact: "No tickets. A score of 250 pays 10 tickets." BERRY PICKING adds "Blue 10, green 30, gold 50; every one that lands costs 50." That's four lines of numbers in a card that's half the screen at 400x256. The help line ("SPACE jumps everyone on the ground...") then sits outside the card on the dimmed background. The 1280x800 reference has the same layout.
- **Where / repro:** Open either cabinet.
- **Screenshot:** ../shots/game-corner-02-jump-picker.png
- **Why it is bad:** "2,500 pays 20" reads as 20 more on top of the 10. In fact the 20 is the day's total (`tickets.ts:414`, owed minus already paid). The after-game line just repeats the first tier.
- **Fix:** Show the tiers as a ladder of three lamps, matching the lamps on the cabinet front: "250 → 10 · 2,500 → 20 total · 6,000 → 30 total". Have the after-game line say what's next instead ("Next: 250 for 10 tickets"), and drop it when it only repeats the card.

### 9. Small slips on the cabinet screens  [kind: menu-look]
- **Seen:** The title strip reads "GAME CORNER · ▸ POKÉMON JUMP", a dot and an arrow as separators side by side (also in `docs/screens/menu-look/after/game-corner.png`). The help lines switch to mixed case ("Pikachu is jumping. Choose again to sit it out.", "Ivysaur cannot play.") under a list that writes PIKACHU and IVYSAUR. A "Find: a name or a box" search field sits over a list of one to three Pokémon. A newcomer with one Pokémon is told CHARMANDER lives in "Box 1", a word this room never explains.
- **Where / repro:** Open POKéMON JUMP, move the cursor over the rows.
- **Screenshot:** ../shots/game-corner-13-mid-cannot-jump.png, ../shots/game-corner-11-jump-toggle.png
- **Fix:** Use one separator in the breadcrumb. Use the list's capitalised name in the help (`gameCornerView.ts:93-100`). Hide the find field below about six rows.

### 10. The HIGH SCORES caption covers the player and the counter  [kind: menu-look]
- **Seen:** Standing at the board (10,3), the caption "HIGH SCORES / Today's best on the promenade" is seated over the floor in front of the counter and hides the player's sprite. Seen at 400x256.
- **Screenshot:** ../shots/game-corner-14-board-caption.png
- **Fix:** Seat it over the board's own face, or drop the note. The board already says what it is.

### 11. Reading the board is seven dialogue boxes  [kind: wall-of-text]
- **Seen:** Both saves. SPACE at HIGH SCORES reads out "JUMP: OG-NELL 4,890, FINNY2011 3,380, TOISE4LIFE 3,200", then BERRY, COURSE, DERBY, DIG and FISHING one box each, then "Nothing of yours on it today. Play anything on the promenade." The DERBY row reads "1MORERAID 1ST, XKITX 2ND, TESS-SWIMS 2ND", two second places in a top three.
- **Screenshot:** ../shots/game-corner-04-board-read.png
- **Fix:** Open the board as one pixel-ui panel, a row per game with its top three and YOU in gold, instead of seven text boxes. For the derby, show the best finish per regular with the course level, or drop the tie.

## What is actually good
- The minigames are real. POKéMON JUMP's vine, VENUSAUR on its mound and the countdown, and BERRY PICKING's falling blue berries under a two-headed DODUO, both read as FireRed's and both play on the first press.
- The loans are the right idea. Neither save could play otherwise: the mid-game IVYSAUR and DIGLETT are both "CANNOT JUMP", with a clear reason and a list of kinds that can.
- The cabinet caption updates after a game ("Today 60 · nothing paid yet"), and the lamps on the cabinet fronts are a neat at-a-glance tally.
- The room looks like an arcade: two neon rows, a counter, a lit HIGH SCORES board, people queueing behind players.

## Everything I read
- Outside: door caption "GAME CORNER / JUMP · BERRY PICKING · TICKETS" on PIER SQUARE (both saves).
- ATTENDANT: from the mat (7,11) and from the counter (5,4), five talks over both saves, the same four boxes each time. The tickets line never came up (neither save held tickets).
- HIGH SCORES board: wall picture, caption "Today's best on the promenade", all seven read-out boxes (both saves).
- POKéMON JUMP cabinet: caption ("Jump the vine for TICKETS", "Today 60 · nothing paid yet"), the WHO JUMPS? screen (rows, tags, Can't jump section, every help line I could reach, find field, PLAY/AGAIN, rate card, result lines), the countdown, the game HUD ("SCORE / JUMPS", "+50", "OUCH!", "SPACE: jump · ESC: stop"). Played about ten games over both saves, best 60. Through the act tool's coarse key timing I couldn't reach the 250 tier, so I never saw a payout screen. That's a limit of the tool, not counted against the game.
- BERRY PICKING cabinet: caption, the WHO PICKS? screen (DODUO loan, NOT A PICKER section, "no beak for it", help, rules and rate card), HUD ("SCORE / EATEN / MISSES LEFT", "LEFT · UP · RIGHT: pick · ESC: stop"). Played three games, final scores 0 (EATEN 5 each time).
- Regulars, all talked to at least twice where I could: TESS-SWIMS (new save, four times), SKYEZARD, BEEBEE22, TOISE4LIFE, XKITX, DEXHUNTER (new save, second crowd), FINNY2011, KARPKING, OG-NELL, 1MORERAID, DEXHUNTER (mid-game).
- The PRIZE WINDOW was not visited (out of scope).
