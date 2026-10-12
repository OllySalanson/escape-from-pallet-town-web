import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stitch } from '../../stitch';
import greystoneVale from '.';

const SHIPPED = fileURLToPath(
  new URL('../../../../src/game/world/maps/greystoneVale.json', import.meta.url),
);

describe('Greystone Vale', () => {
  it('ships exactly what its program draws', () => {
    const world = greystoneVale();
    const { file, problems } = stitch(
      world.plan,
      Object.fromEntries(Object.entries(world.districts).map(([id, result]) => [id, result.file])),
    );
    expect(problems).toEqual([]);
    // Written by `npx vite-node tools/mapcraft/world.mts -- tools/mapcraft/worlds/greystoneVale/index.ts
    // <out> --write=src/game/world/maps/greystoneVale.json`, which writes only a passing world.
    expect(readFileSync(SHIPPED, 'utf8'), 'the shipped file is out of date: write it again').toBe(
      `${JSON.stringify(file, null, 1)}\n`,
    );
  });
});
