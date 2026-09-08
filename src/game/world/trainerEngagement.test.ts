import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRunTrainerEncounters } from './trainers';
import {
  BACK_AWAY_OPTION,
  CHALLENGE_OPTION,
  TRAINER_COMMITMENT_LINE,
  TRAINER_WATCH_WARNING,
  trainerChallengePrompt,
  trainerDeclinedMessage,
  trainerWatchCaption,
} from './trainerEngagement';

const worldSceneSource = await readFile(
  new URL('../scenes/WorldScene.ts', import.meta.url),
  'utf8',
);
const battleSceneSource = await readFile(
  new URL('../scenes/BattleScene.ts', import.meta.url),
  'utf8',
);

describe('the question put before a trainer fight', () => {
  it('names the trainer and the fact that the fight has no exit', () => {
    const prompt = trainerChallengePrompt('RAIDER MAYA');

    expect(prompt.lines[0]).toContain('RAIDER MAYA');
    expect(prompt.lines).toContain(TRAINER_COMMITMENT_LINE);
    expect(prompt.options).toEqual([CHALLENGE_OPTION, BACK_AWAY_OPTION]);
  });

  it('highlights the option that costs nothing', () => {
    const prompt = trainerChallengePrompt('SCOUT LEE');

    expect(prompt.options[prompt.selected]).toBe(BACK_AWAY_OPTION);
  });

  it('says so when the player walks away, so declining is visibly a decision', () => {
    expect(trainerDeclinedMessage('WARDEN IVY')).toContain('WARDEN IVY');
  });
});

describe('the caption over watched ground', () => {
  it('carries who, where they are looking, and what stepping in commits to', () => {
    expect(trainerWatchCaption('RAIDER MAYA', 'NORTH')).toBe(
      `RAIDER MAYA\nWATCHING NORTH\n${TRAINER_WATCH_WARNING}`,
    );
  });

  it('is the only thing WorldScene writes into a watch caption', () => {
    // Written as a literal here once, the caption said where the price was but
    // never what it cost, and the two surfaces could drift apart word by word.
    expect(worldSceneSource).toContain(
      'trainerWatchCaption(encounter.trainer.name, WATCH_BEARING[encounter.facing])',
    );
    expect(worldSceneSource).not.toContain('WATCHING ${WATCH_BEARING');
  });
});

/**
 * There are exactly two ways into an authored trainer fight, and both have to
 * say the same thing before it starts. A trainer with a watch can be walked
 * into or spoken to; one without can only be spoken to.
 */
describe('every road into an authored trainer fight', () => {
  it('is warned: a watch by its caption, and the interact key by its prompt', () => {
    for (const encounter of createRunTrainerEncounters()) {
      // The spoken route exists for all four, watch or no watch.
      expect(trainerChallengePrompt(encounter.trainer.name).lines).toContain(
        TRAINER_COMMITMENT_LINE,
      );
      if ((encounter.sightRange ?? 0) > 0) {
        // A watch adds a second road in - one the player walks rather than
        // presses a key for - so its ground is captioned with the same fact.
        expect(trainerWatchCaption(encounter.trainer.name, 'NORTH')).toContain(
          TRAINER_WATCH_WARNING,
        );
      }
    }
    // And nothing else may start one: the only place a spoken trainer becomes
    // a pending battle is behind the prompt.
    expect(worldSceneSource).toContain('this.askForTrainerChallenge(trainer);');
    expect(worldSceneSource.match(/isHunter: false,/g)).toHaveLength(2);
  });

  it('is a commitment the battle screen still honours, and an equipped one', () => {
    const mainActions = battleSceneSource.slice(
      battleSceneSource.indexOf('private mainActions()'),
      battleSceneSource.indexOf('private goBack()'),
    );

    // The warning is only true while an authored trainer fight has no exit.
    // Two command sets offer one - the hunter's priced FLEE and the wild RUN -
    // and the authored trainer's is deliberately not one of them.
    expect(mainActions.match(/'choose-run'/g)).toHaveLength(2);
    expect(mainActions).toContain('this.hunterBattle');
    // Every command set can reach the bag, most of all the one that cannot be
    // left: an unescapable fight must not also be an unequipped one.
    expect(mainActions.match(/'choose-item'/g)).toHaveLength(3);
  });
});
