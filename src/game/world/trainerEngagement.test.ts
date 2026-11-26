import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createRunTrainerEncounters } from './trainers';
import {
  BACK_AWAY_OPTION,
  CHALLENGE_OPTION,
  TRAINER_WATCH_WARNING,
  spokenLineIndex,
  trainerChallengePrompt,
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
  it('is the trainer\'s own first line, and the choice', () => {
    const prompt = trainerChallengePrompt('SCOUT TAM', "You look like you've got a minute. You haven't. Battle me anyway!");

    expect(prompt.lines).toEqual(["SCOUT TAM: You look like you've got a minute. You haven't. Battle me anyway!"]);
    expect(prompt.options).toEqual([CHALLENGE_OPTION, BACK_AWAY_OPTION]);
  });

  it('asks in FireRed\'s words for a trainer with nothing to say', () => {
    expect(trainerChallengePrompt('RAIDER MAYA').lines).toEqual(['RAIDER MAYA would like to battle!']);
  });

  it('takes the line the trainer says, not the one told about them', () => {
    expect(spokenLineIndex(['MAYA HAS THE ROAD IN SIGHT.', 'The reeds go around. The road goes through me.'])).toBe(1);
    expect(spokenLineIndex(['LANCE!'])).toBe(-1);
  });

  it('highlights the option that costs nothing', () => {
    const prompt = trainerChallengePrompt('SCOUT LEE');

    expect(prompt.options[prompt.selected]).toBe(BACK_AWAY_OPTION);
  });

  it('reads no stat card and no rule, as FireRed\'s trainer does not (the Millbrook critic, 26 Nov 2026)', () => {
    const said = trainerChallengePrompt('MISTY', 'My policy is an all-out offensive with WATER-type POKéMON!').lines.join(' ');

    expect(said).not.toMatch(/Lv \d|Pokémon, lead|cannot be fled/);
  });
});

describe('the caption over watched ground', () => {
  it('carries who, where they are looking, and what stepping in commits to', () => {
    expect(trainerWatchCaption('RAIDER MAYA', 'up')).toBe(
      `RAIDER MAYA\nFACING NORTH\n${TRAINER_WATCH_WARNING}`,
    );
  });

  it('is the only thing WorldScene writes into a watch caption', () => {
    // Written as a literal here once, the caption said where the price was but
    // never what it cost, and the two surfaces could drift apart word by word.
    expect(worldSceneSource).toContain(
      'trainerWatchCaption(encounter.trainer.name, encounter.facing)',
    );
    expect(worldSceneSource).not.toContain('FACING ${');
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
      // The spoken route exists for all four, watch or no watch, and asks first.
      expect(trainerChallengePrompt(encounter.trainer.name, encounter.introLines[spokenLineIndex(encounter.introLines)]).options).toEqual([
        CHALLENGE_OPTION,
        BACK_AWAY_OPTION,
      ]);
      if ((encounter.sightRange ?? 0) > 0) {
        // A watch adds a second road in - one the player walks rather than
        // presses a key for - so its ground is captioned with the same fact.
        expect(trainerWatchCaption(encounter.trainer.name, encounter.facing)).toContain(
          TRAINER_WATCH_WARNING,
        );
      }
    }
    // And nothing else may start one: the only place a spoken trainer becomes
    // a pending battle is behind the prompt.
    expect(worldSceneSource).toContain('this.askForTrainerChallenge(trainer);');
    // And the question is the trainer's own first line.
    expect(worldSceneSource).toContain('trainerChallengePrompt(encounter.trainer.name, encounter.introLines[spokenLineIndex(encounter.introLines)])');
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
