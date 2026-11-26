# THE HARBOUR's worst places, played again by a fresh critic

On 26 Nov 2026 the harbour critic tour scored fifteen places in THE HARBOUR,
4.6 out of 10 on average. Nine pull requests fixed what it found (#967 to
#975). Then a fresh critic, who had not seen the first reviews, played the
five worst places again on `main` at `7f12e5e2`, on the same two saves: a
player just home from the free first raid, and a mid-game player with MISTY
beaten. The critic's brief was the first tour's own, word for word.

| Place | Before | After | What still hurts most |
|---|---|---|---|
| THE POKéMON CENTER | 4 | **6** | Machine I's sign kept its own price once machine II was built, and the ward's sign counted beds already used (both fixed in this change) |
| THE GAME CORNER | 3 | **5** | The lent PIKACHU was drawn as a BULBASAUR, and SPACE at the end of a game started the next one (both fixed in this change) |
| OAK'S LAB | 4 | **5** | The Pokédex names where a kind lives in places the player has not walked; the wall map said cave Pokémon live in tall grass (fixed in this change) |
| THE GREAT LIBRARY | 3 | **4** | THE BOLTHOLE book said most furniture is found on raids (fixed in this change); the golden book reads as an answer key |
| THE BOLTHOLE, upstairs | 4 | **4** | MY PC loses its cursor after GARDEN, the wardrobe at a small window, and the console asks for a name before it plays (none of them touched yet) |

The five reviews are under `reviews/`, with their pictures under `shots/`.
They were made with `tools/playtest/ai-player/act` on a test-mode build
(`act start --harbour=local --save=<file>`), one browser at a time. Test mode
draws with the cheap renderer, so water and grass have no tint.
