# Choosing a starter with the mouse

`tools/playtest/starterHover.mjs` takes these. Before the fix, pointing at a card
rebuilt the screen inside its own focus event: the cards fell back to their
unmeasured width, the cursor was lost and two waiting cursor moves took turns
choosing for ever. Now the pointer rings the card and chooses nothing, and a
click or an arrow key chooses it without rebuilding anything.

- `before-hover.png`: pointing at Charmander, before.
- `after-hover.png`: pointing at Charmander with Bulbasaur chosen.
- `after-chosen.png`: Charmander clicked.
