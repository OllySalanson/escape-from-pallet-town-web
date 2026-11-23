# A wipe with nobody fit to raid says so in two lines

The result screen's help bar holds two lines and clips the rest (`.px-help` in `style.css`). After a wipe that left nobody able to raid, the note read "What you lost stays lost, but Oak keeps a starter kit for this: 3 Poké Balls and 1 Satchel are waiting at base, but nobody is fit to raid: revive a Pokémon at the Pokémon Center first." It needed three lines, so it stopped at "revive a Pokémon at the".

- `before.png`: main, a lone Squirtle beaten by the hunter.
- `after.png`: the same loss after the change.

Made with `tools/playtest/ai-player/act` on a test-mode build (`?testmode=1`), from a save whose only Pokémon was set to 2 HP.
