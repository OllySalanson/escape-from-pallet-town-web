# Up the steps at Gull Strand, and a pack-full chip that says where the room is

| Picture | What it shows |
| --- | --- |
| `before-stuck-on-the-steps.png` | The captain's own picture (26 Nov 2026, night raid): on the stone steps cut down Gull Strand's cliff to the cove, and no further. Only the two steps were ground; the cut above them was rock. The chip says `NO ROOM: NEEDS 4 SQUARES`, which does not say room in what. |
| `after-up-the-steps.png` | The same flight climbed: the player on the grass over its head, the partner on the landing behind. |
| `after-pack-full-chip.png` | A stake that will not go in: the chip now says `PACK FULL: NEEDS 8 SQUARES · [B] PACK`, the PACK being where the squares are and B what opens it. |

How they were made, against a test-mode build (`tools/playtest/README.md`, "Memory"):

    node tools/playtest/stairs.mjs <build url> <out dir>
    node tools/playtest/characters2Fixes.mjs "<build url>?testmode=pixels" <out dir> --only=stake
