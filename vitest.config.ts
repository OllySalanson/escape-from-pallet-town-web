import { defineConfig } from 'vitest/config';

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
  },
});
