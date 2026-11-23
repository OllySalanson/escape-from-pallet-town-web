# A box name keeps only what the typeface draws

MY PC's RENAME was given "Fire 🔥🔥 box with a very very long name" as a paste. The field's 12-character limit kept "Fire 🔥🔥 bo".

- `before.png`: main at c1c14088. The box is saved as "Fire 🔥🔥 bo" and drawn as "FIRE ⍰⍰ BO", because the pixel font has no emoji.
- `after.png`: this change. The emoji are taken out as the name is tidied, so the box is "Fire bo".

Made with the playtest harness on a test-mode build at 800x512: THE BOLTHOLE, upstairs, MY PC, RENAME, then the text sent as a paste (CDP `Input.insertText`) and SAVE. The two saves differ (a new game's Squirtle in the first, a Charmander and two Pidgeys in the second); the box name is what to look at.
