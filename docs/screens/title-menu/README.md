# Title menu: Continue / New Game

Screens at 3x (`*-3x.png`, the 400x256 stage) and on the smallest stage
(`*-small.png`, 320x240 at 3x):

- `title-fresh` - a browser with no save. CONTINUE is drawn dim and says
  `NO SAVED GAME`; the cursor starts on NEW GAME and never lands on the dead row.
- `title-saved` - a game in progress. CONTINUE holds the cursor and says whose
  game it is (`1 POKEMON · 0 CONTRACTS`); NEW GAME says what it costs
  (`ERASES THE SAVE`) before it is chosen.
- `title-erase-question` - NEW GAME over a save asks first, and the cursor starts
  on KEEP MY GAME, because the key that woke the game is still down. Escape is
  also KEEP.
- `title-unreadable` - a save the loader refuses is named as such, not called
  empty.

## Why there are no slots

Not built, on purpose.

- **The vault is the whole game.** A save here is one stash, one raid record and
  one set of contracts; there is no second character, difficulty or route a slot
  would hold apart. Slots would be a way to keep a spare copy, which is a backup
  question and not a title-screen one.
- **The protection is the erase question.** The only thing a slot would have
  bought that matters is *starting again without destroying this one*. That is a
  choice made once, on a screen that says what it costs and starts on the safe
  answer.
- **Every accepted version would have to work in every slot.** `SaveManager`
  accepts five versions and each is pinned in `SaveManager.test.ts`; a slot index
  multiplies that surface (a key per slot, a migration path per key, the title's
  summary reading all of them) for a player who will, in nearly every case, have
  one.

If a spare copy is ever wanted, an explicit "export / import save" is the smaller
and safer thing - it keeps one live save and puts the second copy somewhere the
game cannot overwrite it.
