# Six strangers, round 2: the fixes

The faults the second six-character playtest (1 Nov) found that were still there on `main`, played where a player meets them. Each pair is the same moment on a build of `main` (`-before`) and on a build of the fix (`-after`).

| Picture | What it shows |
|---|---|
| `stake-no-room` | The stake (2 Parts crates) will not go in a packed-full pack. Before: the gold arrow leads on to it. After: the arrow is green to the way out, and the prize chip says `NO ROOM: NEEDS 8 SQUARES`. |
| `stake-room-made-after` | A few Potions put down: the gold arrow comes back for the stake, and the chip says `TAKE 2 PARTS CRATES: E`. |
| `job-arrow` | A raid with a job (Sealed dispatch). Before: the chip says `DISPATCH: E` and the gold arrow goes up to the ₽10. After: the arrow goes east, to the dispatch. |
| `rail-hunter-line` | The card's hunter line on a pressured job. Before: `+3 contract, 30s sooner`. After: `this job: 30s sooner, much stronger`. |
| `joy-at-cap` | Hurt, with the next raid already down to 2:30. Before: "It will not cost your next raid a second", and SPACE heals. After: she says it is as short as she will make it, and to raid first. |
| `bill-stranger` | A stranger with ₽570. Before: "Bring things home from a raid", which earns no standing. After: "Bank a job off Oak's board", and then how many jobs. |
| `rack-hover` | The Potion's box on the armoury rack. Before: it covers the Poké Ball row's name. After: it stands beside the row. |

## How they were made

```bash
VITE_EPTW_TEST_MODE=1 npx vite build --outDir "$SCRATCH/root/escape-from-pallet-town-web"
(cd "$SCRATCH/root" && python3 -m http.server "$PORT")
node tools/playtest/characters2Fixes.mjs "http://127.0.0.1:$PORT/escape-from-pallet-town-web/?testmode=pixels" "$OUT" [--port=CDP] [--only=stake,job,joy,bill,rack]
```

The same script was run against both builds, on stepped frames at 1200x768. It prints PASS or FAIL for each check as the fix means it to come out.
