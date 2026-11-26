# Two discs in Millbrook, for the first hour's fights

The critic's review, problem 19: "Slow fights with nothing in them: one-move Pokemon and a wild Jigglypuff that can only Sing." A Charmander has Scratch and Growl until Lv 7; an Oddish has Absorb alone until 15. Teaching the wild side to fight back made the first raids measurably deadlier, so the answer is on the player's side (firstmate's call, 26 Nov 2026): an existing disc in the first district.

Two prizes now roll in MILLBROOK, the district every new save lands in, at the odds a prize may have (three raids in ten each): TM28 Dig (Charmander, Squirtle) and TM09 Bullet Seed (Bulbasaur, and the allotment's own Oddish). Each is seated on a free tile of Millbrook; its fallback is the dug allotments. Over 300 seeded raids, Dig lay in Millbrook 26% of the time and Bullet Seed 32%, never on one tile. A starter's own disc turns up within five raids for about five players in six.

- `ground.png` - seed 5: TM09 Bullet Seed on the ground east of the mill lane, two tiles from the player.
- `pack.png` - picked up: the disc in the pack, beside the Potions and Poké Balls.

Before this there was no disc in Millbrook at all, so the before picture is the same ground with nothing on it.

Made with `node tools/playtest/raid.mjs <url> --pixels --stepped --seed=5 --insertion=greystone-vale --skip-contract --grab=tm09-bullet-seed --shot=...`. That run also fixed the driver: with nothing laid to grab it pressed B for the pack picture under the opening briefing and failed.
