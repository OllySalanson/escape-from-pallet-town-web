import { describe, expect, it } from 'vitest';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { catchLessonMessage, catchLessonOpening } from '../pokemon/battle/battleFlow';
import { FIRST_CATCH_LEVEL, firstCatchCaughtLines, firstCatchFigures, FIRST_CATCH_LANDING_LINES } from './firstCatch';
import { TEACHING_ENCOUNTER } from './teachingEncounter';
import { stepDistances } from './mapStructure';

/** A new save's first raid begins with a catch: the overnight critic's problems 4 and 6. */
describe("the first raid's catch", () => {
  const vale = getWorldMap('greystone-vale');
  const landing = RUN_INSERTIONS['greystone-vale'].position;

  it("finds two of Mill Square's Pidgey by the landing: one to catch and one to try again on", () => {
    const figures = firstCatchFigures(vale.entities, landing);
    expect(figures).toHaveLength(2);
    for (const figure of figures) {
      expect(figure.pokemon).toBe('pidgey');
      // Scenery on every other raid: it fights only on the first.
      expect(figure.wildLevel).toBeUndefined();
    }
  });

  it('stands them where the landing can walk up to them', () => {
    const steps = stepDistances(vale.collision, landing);
    for (const figure of firstCatchFigures(vale.entities, landing)) {
      const beside = [
        { x: figure.position.x + 1, y: figure.position.y },
        { x: figure.position.x - 1, y: figure.position.y },
        { x: figure.position.x, y: figure.position.y + 1 },
        { x: figure.position.x, y: figure.position.y - 1 },
      ];
      expect(beside.some((tile) => (steps[tile.y]?.[tile.x] ?? -1) >= 0), figure.id).toBe(true);
    }
  });

  it("fights at the teaching fight's measured level, which every starter wins", () => {
    expect(FIRST_CATCH_LEVEL).toBe(TEACHING_ENCOUNTER.level);
  });

  it('says one thing on landing, and the pack, the risk and the choice once it is caught', () => {
    expect(FIRST_CATCH_LANDING_LINES).toHaveLength(1);
    expect(FIRST_CATCH_LANDING_LINES[0]).toContain('PIDGEY');
    expect(FIRST_CATCH_LANDING_LINES[0]).not.toMatch(/ENRAGED|pack|hunter/);
    const lines = firstCatchCaughtLines('Pidgey', 'Westward Road');
    expect(lines[0]).toBe("OAK: Got it! PIDGEY rides in your pack now, in 4 squares. Get out of the vale and it's yours.");
    expect(lines.join(' ')).toContain('WESTWARD ROAD');
    expect(lines.join(' ')).toContain('hunter');
  });
});

describe("the catch lesson's words", () => {
  it('say how a catch is made on the way in', () => {
    expect(catchLessonOpening('Pidgey')).toEqual([
      'Wild PIDGEY appeared!',
      'Wear it down with FIGHT, then throw a BALL to keep it.',
      "FIGHT shows each move's POWER and type matchup.",
    ]);
  });

  it('say "throw a BALL now" only while it is under half and still up', () => {
    expect(catchLessonMessage({ enemyHp: 7, enemyMaxHp: 13, fightGoesOn: true })).toBeNull();
    expect(catchLessonMessage({ enemyHp: 6, enemyMaxHp: 13, fightGoesOn: true })).toMatch(/^It's weak! Throw a BALL now/);
    expect(catchLessonMessage({ enemyHp: 0, enemyMaxHp: 13, fightGoesOn: false })).toBeNull();
    expect(catchLessonMessage({ enemyHp: 3, enemyMaxHp: 13, fightGoesOn: false })).toBeNull();
  });
});
