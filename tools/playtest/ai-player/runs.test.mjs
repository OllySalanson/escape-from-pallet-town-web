// The AI playtester's run tracking: the status file the dashboard reads, the
// findings file a report is written from, and the stuck rule.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  GIVE_UP_AFTER,
  STUCK_AFTER,
  createRun,
  foldAction,
  listRuns,
  newRunId,
  progressSignature,
  readFindings,
  readStatus,
  recordFinding,
  writeStatus,
} from './runs.mjs';

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'eptw-ai-runs-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const screen = ({ tile = { x: 1, y: 1 }, done = 0, said = null } = {}) => ({
  scenes: ['world'],
  scene: { world: { map: 'greystone-vale', tile, dialogue: said ? { text: said, complete: true } : null, raid: { elapsedMs: 4000 } } },
  menu: null,
  progress: {
    done,
    total: 7,
    finished: done === 7,
    milestones: [{ id: 'misty', label: 'Misty beaten', done: done > 0, finish: true }],
  },
});

describe('a run', () => {
  it('names itself by when it started and who is playing, and writes a status file', () => {
    const at = new Date(2026, 10, 20, 1, 2, 3);
    expect(newRunId('veteran', at)).toBe('20261120-010203-veteran');
    const status = createRun({ persona: 'newcomer', runId: 'r1', root, now: 1000 });
    expect(readStatus('r1', root)).toEqual(status);
    expect(status).toMatchObject({ persona: 'newcomer', state: 'playing', startedAt: 1000, raids: 0, stuckCount: 0 });
    expect(() => createRun({ persona: 'speedrunner', root })).toThrow(/persona/);
  });

  it('lists runs newest first', () => {
    createRun({ persona: 'veteran', runId: 'old', root, now: 1 });
    createRun({ persona: 'newcomer', runId: 'new', root, now: 2 });
    expect(listRuns(root).map((run) => run.runId)).toEqual(['new', 'old']);
  });

  it('keeps findings with their screenshot, and counts them by kind', () => {
    const status = createRun({ persona: 'veteran', runId: 'r2', root });
    const { status: after } = recordFinding(status, { kind: 'ai-feel', text: '"It is what it is." - the baker', shot: 'shots/1.png', now: 5 }, root);
    writeStatus(after, root);
    expect(readStatus('r2', root).findings).toEqual({ bug: 0, confusing: 0, 'ai-feel': 1 });
    expect(readFindings('r2', root)).toEqual([
      { at: 5, runId: 'r2', persona: 'veteran', kind: 'ai-feel', text: '"It is what it is." - the baker', shot: 'shots/1.png', where: null, goal: null },
    ]);
    expect(() => recordFinding(status, { kind: 'nitpick', text: 'x' }, root)).toThrow(/finding/);
    expect(readFileSync(join(root, 'r2', 'findings.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
  });
});

describe('foldAction', () => {
  const fold = (status, s, events = []) => foldAction(status, { action: 'walk', screen: s, events, signature: progressSignature(s), now: 99 });

  it('counts raids, extractions and wipes from the event log, and reads the finish line', () => {
    const status = createRun({ persona: 'veteran', runId: 'r3', root });
    const { status: after } = fold(status, screen({ done: 1 }), [
      { n: 4, kind: 'extracted' },
      { n: 9, kind: 'wiped' },
      { n: 10, kind: 'moved' },
    ]);
    expect(after).toMatchObject({ raids: 2, extractions: 1, wipes: 1, lastEvent: 10, milestonesDone: 1, milestonesTotal: 7, actions: 1, lastActionAt: 99, raidClockMs: 4000 });
    expect(after.milestones).toEqual([{ id: 'misty', label: 'Misty beaten', done: true, finish: true }]);
  });

  it('calls a run stuck after enough actions that change nothing, then tells it to give up', () => {
    let status = createRun({ persona: 'newcomer', runId: 'r4', root });
    const advice = [];
    for (let i = 0; i <= STUCK_AFTER + GIVE_UP_AFTER; i += 1) {
      const folded = fold(status, screen());
      status = folded.status;
      advice.push(folded.advice);
    }
    expect(advice[STUCK_AFTER]).toMatch(/^STUCK: nothing has changed/);
    expect(advice[STUCK_AFTER + GIVE_UP_AFTER]).toMatch(/give this goal up/);
    expect(advice.slice(0, STUCK_AFTER).every((each) => each === null)).toBe(true);
    expect(status).toMatchObject({ stuck: true, stuckCount: 1 });
    // One step anywhere is progress, and clears it.
    const moved = fold(status, screen({ tile: { x: 2, y: 1 } }));
    expect(moved.status).toMatchObject({ stuck: false, sameFor: 0, stuckCount: 1 });
    expect(moved.advice).toBeNull();
  });

  it('counts a new line of dialogue as something changing', () => {
    expect(progressSignature(screen({ said: 'Hello.' }))).not.toBe(progressSignature(screen({ said: 'Bye.' })));
    expect(progressSignature(screen())).toBe(progressSignature(screen()));
  });

  it('marks the run finished the first time every finish milestone is done', () => {
    const status = createRun({ persona: 'veteran', runId: 'r5', root });
    const { status: after, advice } = fold(status, screen({ done: 7 }));
    expect(after).toMatchObject({ finished: true, state: 'finished' });
    expect(advice).toMatch(/^FINISHED/);
  });
});
