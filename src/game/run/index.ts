export {
  RunManager,
  RunPhase,
  type ItemStack,
  type RunConfig,
  type RunLoadout,
  type RunResult,
  type RunSnapshot,
  type SecureSlot,
} from './RunManager';

import { RunManager } from './RunManager';

/** The game-wide transient raid owner shared by the hub and run scenes. */
export const activeRunManager = new RunManager();
