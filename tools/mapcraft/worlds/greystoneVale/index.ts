/**
 * Greystone Vale as a world program: the plan, and every district drawn so far.
 *
 *   npx vite-node tools/mapcraft/world.mts -- tools/mapcraft/worlds/greystoneVale/index.ts out/greystone-vale
 *
 * A district is added here as it is drawn, each in its own file beside this one,
 * once the vale can reach it.
 */
import type { WorldResult } from '../../worldReport';
import { emberIsle } from './emberIsle';
import { frostreef } from './frostreef';
import { greystonePeaks } from './greystonePeaks';
import { gullStrand } from './gullStrand';
import { highMoor } from './highMoor';
import { lostGarden } from './lostGarden';
import { millbrook } from './millbrook';
import { orchardTerraces } from './orchardTerraces';
import { pineHollow } from './pineHollow';
import { GREYSTONE_VALE } from './plan';
import { powerStation } from './powerStation';
import { reedmere } from './reedmere';
import { safariMarsh } from './safariMarsh';
import { smugglersCove } from './smugglersCove';
import { stormcrown } from './stormcrown';
import { sunkenQuarter } from './sunkenQuarter';
import { tanglewood } from './tanglewood';
import { theCrossing } from './theCrossing';
import { theWreck } from './theWreck';

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
      'power-station': powerStation(),
      'safari-marsh': safariMarsh(),
      'the-wreck': theWreck(),
      'sunken-quarter': sunkenQuarter(),
      'smugglers-cove': smugglersCove(),
      stormcrown: stormcrown(),
      'lost-garden': lostGarden(),
      frostreef: frostreef(),
      'ember-isle': emberIsle(),
    },
  };
}
