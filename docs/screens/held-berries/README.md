# Held berries and the gap-covering discs

Gyms step 4: a berry held fires by itself, TM11 Sunny Day and TM18 Rain Dance are
discs, and TM28 Dig is laid in the caves (THE DIGGINGS, Greystone Caves 1F).

- `team-give-chesto.png` - a Chesto Berry given from the raid pack on the team screen.
- `teach-sunny-day.png` - TM11 read out of the raid pack.
- `plate-holding-chesto.png` - the plate names what is held, the HP numbers now end under the bar.
- `chesto-wakes.png` - Sleep Powder lands and the berry wakes its holder on the very next line; the plate no longer names it.
- `sunny-day.png` - the sunlight turned harsh.
- `tm28-in-the-diggings.png`, `tm28-in-the-pack.png` - TM28 on the cave floor beside the Diglett and Sandshrew, and in the pack.

Made with `node tools/playtest/heldBerries.mjs <url> <dir>` and
`node tools/playtest/raid.mjs <url> --pixels --stepped --seed=3 --insertion=greystone-vale-the-quarry --steps=into:170:86:Up --grab=tm28-dig --shot=<dir>/dig.png`
against a test-mode build.
