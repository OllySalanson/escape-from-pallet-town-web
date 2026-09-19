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
     */
    testTimeout: 30_000,
    maxWorkers: MAX_WORKERS,
  },
});
