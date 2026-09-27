# A trainer's third Pokemon

A three-Pokemon trainer fought with every line read the instant it is up,
photographed 1.5 seconds after the third Pokemon (Pikachu) was sent out
(`node tools/playtest/sendOutShots.mjs <dev url> out.png`, 3x).

| | enemy sprite after 1.5s |
|---|---|
| `before.png` | alpha 0, y 125 against a spot at 68: nothing on the field, the HP bar empty, and the player's Charmander pushed off to the left |
| `after.png` | alpha 1, standing on its spot at 245,68, full HP bar |

The before picture is three faults with one cause. A slot keeps one sprite for
the whole fight, and the tweens a knockout starts (the faint's fade and drop,
the hit flash, the lunge's blow) went on writing to it after the next Pokemon
was drawn on it. Each fade and each lunge was relative to where the sprite
already stood, so every knockout pushed the next one further: at a calm 300ms a
press nothing showed, at a quick one the second Pokemon came out half faded and
the third was invisible. The blow that knocked the second one out then landed
on the third's freshly drawn plate, which is the empty bar.
