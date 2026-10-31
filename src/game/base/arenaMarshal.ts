import type { DeploymentFlow } from '../hub/deploymentFlow';
import { FIRST_WORDS, hasHeard } from '../hub/firstWords';

/** How many clean landings in a row before anybody remarks on it. */
export const STREAK_WORTH_SAYING = 3;

/**
 * What THE RAID ARENA's marshal says when spoken to. A newcomer is told what the
 * room is, once (`hub/firstWords.ts`); after that she says the one thing that is
 * wrong with the raid being got ready, if anything is, because she can see the
 * bench and the rack from where she stands.
 */
export function marshalLines(heard: readonly string[] | undefined, flow: DeploymentFlow, cleanLandings = 0): readonly string[] {
  if (!hasHeard(heard, 'loadout')) {
    return FIRST_WORDS.loadout.lines;
  }
  const notReady = flow.notReady;
  if (notReady !== undefined) {
    return [notReady];
  }
  if (!flow.packsABall) {
    return flow.ballAtBase
      ? ['No Poké Balls on your rack. You will not catch anything like that.']
      : ['You have no Poké Balls at all. Bill sells them, on the quay.'];
  }
  if (flow.securedPokemon.length === 0 && flow.securedItems.length === 0) {
    return ['Your locker is empty. Lose this raid and you lose the lot.'];
  }
  if (cleanLandings >= STREAK_WORTH_SAYING) {
    return [`You look ready. ${cleanLandings} clean landings running, and the stands are counting.`];
  }
  return ['You look ready. Pick your spot on the rim and go over the fence.'];
}
