/**
 * Greystone Vale as a world program: the plan, and every district drawn so far.
 *
 *   npx vite-node tools/mapcraft/world.mts -- tools/mapcraft/worlds/greystoneVale/index.ts out/greystone-vale
 *
 * A district is added here as it is drawn, each in its own file beside this one,
 * once the vale can reach it: Pine Hollow and Tanglewood (`pineHollow.ts`,
 * `tanglewood.ts`) wait for The Crossing, the only way in to them from Millbrook.
 */
import type { WorldResult } from '../../worldReport';
import { highMoor } from './highMoor';
import { millbrook } from './millbrook';
import { GREYSTONE_VALE } from './plan';
import { reedmere } from './reedmere';

export default function greystoneVale(): WorldResult {
  return { plan: GREYSTONE_VALE, districts: { millbrook: millbrook(), 'high-moor': highMoor(), reedmere: reedmere() } };
}
