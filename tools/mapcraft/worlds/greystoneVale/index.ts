/**
 * Greystone Vale as a world program: the plan, and every district drawn so far.
 *
 *   npx vite-node tools/mapcraft/world.mts -- tools/mapcraft/worlds/greystoneVale/index.ts out/greystone-vale
 *
 * A district is added here as it is drawn, each in its own file beside this one,
 * once the vale can reach it.
 */
import type { WorldResult } from '../../worldReport';
import { greystonePeaks } from './greystonePeaks';
import { gullStrand } from './gullStrand';
import { highMoor } from './highMoor';
import { millbrook } from './millbrook';
import { orchardTerraces } from './orchardTerraces';
import { pineHollow } from './pineHollow';
import { GREYSTONE_VALE } from './plan';
import { reedmere } from './reedmere';
import { tanglewood } from './tanglewood';
import { theCrossing } from './theCrossing';

export default function greystoneVale(): WorldResult {
  return {
    plan: GREYSTONE_VALE,
    districts: {
      millbrook: millbrook(),
      'high-moor': highMoor(),
      'greystone-peaks': greystonePeaks(),
      'pine-hollow': pineHollow(),
      'the-crossing': theCrossing(),
      tanglewood: tanglewood(),
      reedmere: reedmere(),
      'gull-strand': gullStrand(),
      'orchard-terraces': orchardTerraces(),
    },
  };
}
