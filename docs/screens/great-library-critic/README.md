# THE GREAT LIBRARY, after the critic tour

The harbour critic tour of 26 Nov 2026 scored THE GREAT LIBRARY 3/10: the one
book you could open (THE BOLTHOLE) was out of date, and the golden book (VALE
SECRETS) was chained shut for every save, with the librarian saying nothing
about it and the door counting it as a book to read.

`before/` is the critic's own pictures, on `main` at `4391c17e`.
`after/` is this change, played with `tools/playtest/ai-player/act` on a
test-mode build (`act start --rebuild --save=<file>`), once on a new player's
save (home from the free first raid) and once on a mid-game save with MISTY
beaten. Test mode draws with the cheap renderer, so water and grass have no tint.

| What | Before | After |
|---|---|---|
| The door counts the books you can open | `before/1-door.png` (2, with one chained) | `after/1-door-new-save.png` (1); 2 once MISTY is beaten |
| The golden plinth says what opens it | `before/2-golden-locked.png` | `after/2-golden-locked.png`, and `after/2-golden-open.png` with MISTY beaten |
| The librarian names the golden book and its rule | `before/3-librarian.png` | `after/3-librarian-misty-beaten.png` |
| THE BOLTHOLE rewritten from today's house | `before/4-bolthole-name-and-downstairs.png` | `after/4-bolthole-*.png` |
| The globe, the fern and the back bookcases answer | (silent) | `after/5-globe.png` |
