import { defineConfig } from 'vitest/config';

/**
 * This suite is run by several agents on one machine at the same time, and
 * vitest's default is a worker per core: eight suites each fanning out to twelve
 * threads is what took a 12-core box to a load of 29 and had the kernel killing
 * processes. Four is where the suite stops getting meaningfully faster anyway.
 * A machine that has the box to itself - CI - raises it with `VITEST_MAX_WORKERS`.
 */
const MAX_WORKERS = Number(process.env.VITEST_MAX_WORKERS) || 4;

export default defineConfig({
  test: {
    /**
     * Several of the guarantees this project relies on are bought by exhaustive
     * sweeps rather than samples: the hunter suite walks a route from every tile
     * of every map, and `runGeneration.test.ts` generates 500 runs per insertion
     * to prove no seed can hide an exit. Those take seconds of honest work, and
     * against vitest's 5s default they tipped over whenever the parallel run
     * happened to schedule two of them together - a timeout that says nothing
     * about the code. This bound is high enough that only a real hang trips it.
     *
     * It went from thirty seconds to two minutes when the Floodplain grew to
     * 128 tiles square. Those sweeps are quadratic in a map's area - a search
     * per walkable tile over the whole grid - so a map three times the area of
     * any other is a real cost, and it was paid down first rather than
     * waved through: `stepDistances` now walks typed arrays, `MapSketch` no
     * longer rescans every landmark's claims on every tile written (three
     * seconds a build, which was also a raid starting with a stutter), and the
     * flee sweep asks for the map's doors once per tile instead of once per
     * heading. What is left is honest work, and the bound is what it needs.
     *
     * The suite as a whole is kept fast by splitting such sweeps into files,
     * because vitest runs files side by side and the tests inside one in turn:
     * the structure rules were one file and fifteen minutes of CI on one core.
     * See `mapStructure.testkit.ts` and the suite note in `AGENTS.md`.
     */
    testTimeout: 120_000,
    maxWorkers: MAX_WORKERS,
  },
});
