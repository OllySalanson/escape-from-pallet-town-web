/**
 * Greystone Vale as a world program: the plan, and every district drawn so far.
 *
 *   npx vite-node tools/mapcraft/world.mts -- tools/mapcraft/worlds/greystoneVale/index.ts out/greystone-vale
 *
 * A district is added here as it is drawn, each in its own file beside this one.
 */
import type { WorldResult } from '../../worldReport';
import { GREYSTONE_VALE } from './plan';

export default function greystoneVale(): WorldResult {
  return { plan: GREYSTONE_VALE, districts: {} };
}
