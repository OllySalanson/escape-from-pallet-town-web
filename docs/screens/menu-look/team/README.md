# YOUR TEAM on the field

The round-3 mock-up's team screen (Olly, 25 Nov 2026: "I really like style A ... I do
love the big Pokemons"): the next raid's team stands big on the battle field's own grass,
each on a platform cut from the battle's backdrop (`scripts/cut-battle-platform.mjs`), the
lead first with a gold LEAD tag and the partner with its green rosette. The card on the
right is the one under the cursor: its HP, five stats and experience as bars, its moves
as type chips, and what ENTER and L do to it. The boxes run along the foot. The Raid
Arena's bench opens this same screen on the hall's own choices.

- `before-your-team.png`, `after-your-team.png` - P in the harbour, a team of two.
- `before-the-bench.png`, `after-the-bench.png` - the bench in THE RAID ARENA's hall.

Made with `tools/playtest/menusAudit.mjs <test-mode build> <out> --only=your-team,hall-bench --team-of-two`
at 1280x800 (the controls bar shows under the game at that size).
