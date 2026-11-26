# No advice lines on a screen

The captain, 25 Nov 2026: "it's a rule that we don't have these AI advice
lines. Obviously, things that we need to tell people we do, but in a normal
game fashion, not just AI lines slapped on."

An advice line is a sentence a screen always shows that explains a rule, gives a
tip or says what to do next, in nobody's voice but the designer's: "Lost on a
wipe unless they are in the locker", "More ways in open up when you bring this
job home", "Hurt ones go to Nurse Joy", "Partner always goes". A FireRed screen
never has one. It shows the thing and lets the world say the rest.

## What a screen may say

- **What is there, now**: names, numbers, counts, tags, a state ("Fainted.",
  "The pack is empty.", "No supplies at base.", "Nobody yet.").
- **What a thing is**, in the help bar or a description box, the way FireRed's
  bag describes an item ("Restores 20 HP."). The help bar under the cursor is
  that box: it names what the pointed-at control does.
- **Why the game just said no**, at the moment it says it (a refusal, a warning
  about this very action: "This cannot be undone", "Your pack is full, so a
  catch has nowhere to go").
- **A printed card that belongs to the thing**: a cabinet's payout card, a
  cup's rule, a shop's limits ("HELD BERRIES: 3 a day").
- **Results**: the raid report says what happened.

## Where the teaching goes instead

- A person says it, in their own voice, when the player meets them: Oak on the
  radio and his field guide, Nurse Joy at the counter, the Game Corner
  attendant, a keeper's first words.
- The moment says it, once, when it first matters: the catch tip after a ball a
  healthy Pokémon broke out of (`CATCH_TIP_LINE`), said in the battle box once a
  fight.
- The screen shows it: red for what a wipe takes, gold for what comes home, a
  padlock on a safe Pokémon, a bar that fills.

## Checking a screen

Read every line a screen shows without the cursor on anything. For each
sentence ask: is it a fact about now, a name, a number, a refusal of this action
or a printed card? If it is a rule, a tip or a next step, it goes, and if the
player truly needs it a person or a moment in the game says it.

`docs/screens/no-advice-lines/` is the pass that removed them (25 Nov 2026),
with every line that went listed in its README.
