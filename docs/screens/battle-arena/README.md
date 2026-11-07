# THE BATTLE ARENA opens

The harbour arenas plan's H2a (the overnight plan's package N8): a place to battle for
sport at the head of THE PROMENADE, where its garden was.

Made by `tools/playtest/battleArena.mjs` against a test-mode build, in the explorer run:

```
VITE_EPTW_TEST_MODE=1 npx vite build --base=/ --outDir "$SCRATCH/dist"
python3 -m http.server 4823 --directory "$SCRATCH/dist"
node tools/playtest/battleArena.mjs http://127.0.0.1:4823/ docs/screens/battle-arena
```

| Picture | What it shows |
| --- | --- |
| `00-the-dojo-on-the-promenade.png` | Saffron's Fighting Dojo on the lot beside THE GAME CORNER, BATTLE ARENA on its board, its caption saying how the bouts have gone |
| `01-inside-the-dojo.png` | FireRed's dojo: the receptionist behind the counter on the master's floor, straight up the tatami from the door, and today's six regulars in the two lines |
| `02-reception.png` | The receptionist, before the counter opens |
| `03-who-will-you-fight.png` | Today's regulars, each with the three they bring, one already beaten |
| `04-your-three.png` | Up to three from every box (the shared picker), the clauses on the rows, FIGHT at the foot |
| `05-the-bout.png` | The real battle screen: both sides at Lv 30, the vault's Lv 99 Charizard a Lv 30 copy, no bag |
| `06-back-at-the-counter.png` | Back where the bout was asked for, the result said, and written as the one thing the save gains |

The driver checks, beyond the pictures: the regular plays the gym AI, every Pokémon on
both sides is Lv 30 and each side the same size, the bag is empty, no run session, and
the save afterwards differs from the save before in `raidProgress.dojo` alone.
