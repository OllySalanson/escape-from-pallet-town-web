import { describe, expect, it } from 'vitest';
import { runProgress } from './runProgress';
import type { SceneDescription } from './testDescribe';
import { EventWatcher, TestEventLog, type EventProbe } from './testEvents';
import { MISTY_BOSS_ID } from '../world/valeQuarters';

const probe = (scenes: Record<string, SceneDescription>): EventProbe => ({
  scenes: Object.keys(scenes),
  describe: (key) => scenes[key],
});

const kinds = (log: TestEventLog) => log.since().map((event) => event.kind);

describe('TestEventLog', () => {
  it('numbers every event, keeps the newest and answers what came after a number', () => {
    const log = new TestEventLog(3, () => 1000);
    for (let i = 0; i < 5; i += 1) {
      log.record('talked', { text: `line ${i}` });
    }
    expect(log.last).toBe(5);
    expect(log.since().map((event) => event.n)).toEqual([3, 4, 5]);
    expect(log.since(4).map((event) => event.text)).toEqual(['line 4']);
    expect(log.since(4)[0]).toMatchObject({ kind: 'talked', at: 1000, frame: 0 });
  });
});

describe('EventWatcher', () => {
  it('writes down scenes starting and stopping and the player moving between places, not tiles', () => {
    const log = new TestEventLog();
    const watcher = new EventWatcher(log);
    watcher.observe(probe({ base: { place: 'KEEPERS ROW', tile: { x: 1, y: 1 } } }));
    watcher.observe(probe({ base: { place: 'KEEPERS ROW', tile: { x: 2, y: 1 } } }));
    watcher.observe(probe({ base: { place: 'THE PROMENADE', tile: { x: 3, y: 1 } } }));
    watcher.observe(probe({ world: { map: 'greystone-vale', place: 'MILLBROOK' } }));
    expect(kinds(log)).toEqual(['scene', 'moved', 'moved', 'scene', 'scene', 'moved']);
    expect(log.since().filter((event) => event.kind === 'moved').map((event) => event.place)).toEqual([
      'base / KEEPERS ROW',
      'base / THE PROMENADE',
      'world / greystone-vale / MILLBROOK',
    ]);
  });

  it('writes a line down once, when it has finished typing', () => {
    const log = new TestEventLog();
    const watcher = new EventWatcher(log);
    const say = (text: string, complete: boolean) => watcher.observe(probe({ world: { dialogue: { text, complete } } }));
    say('Hel', false);
    say('Hello there.', true);
    say('Hello there.', true);
    say('Bye.', true);
    watcher.observe(probe({ world: { dialogue: null } }));
    say('Bye.', true);
    watcher.observe(probe({ battle: { message: { text: 'A wild PIDGEY appeared!', complete: true } } }));
    expect(log.since().filter((event) => event.kind === 'talked').map((event) => event.text)).toEqual([
      'Hello there.',
      'Bye.',
      'Bye.',
      'A wild PIDGEY appeared!',
    ]);
  });

  it('writes down the answer a prompt was left on when it closes, and a menu press', () => {
    const log = new TestEventLog();
    const watcher = new EventWatcher(log);
    watcher.observe(probe({ base: { choice: { question: 'Take it?', options: ['YES', 'NOT NOW'], selected: 0 } } }));
    watcher.observe(probe({ base: { choice: { options: ['YES', 'NOT NOW'], selected: 1 } } }));
    watcher.observe(probe({ base: { choice: null } }));
    watcher.pressed('JUMP IN', 'THE RIM');
    expect(log.since().filter((event) => event.kind === 'talked').map((event) => event.asks)).toEqual([['YES', 'NOT NOW']]);
    const chose = log.since().filter((event) => event.kind === 'chose');
    expect(chose.map((event) => [event.label, event.by])).toEqual([
      ['NOT NOW', 'prompt'],
      ['JUMP IN', 'menu'],
    ]);
  });

  it('writes down a fight starting and how it ended, and a raid ending', () => {
    const log = new TestEventLog();
    const watcher = new EventWatcher(log);
    watcher.observe(probe({ world: {} }));
    watcher.observe(probe({ world: {}, battle: { foe: { name: 'PIDGEY' }, trainer: null, outcome: 'active' } }));
    watcher.observe(probe({ world: {}, battle: { foe: { name: 'PIDGEY' }, trainer: null, outcome: 'victory' } }));
    watcher.observe(probe({ world: {} }));
    watcher.observe(probe({ extraction: { outcome: 'ESCAPED', exit: 'Extracted · Goat Track' } }));
    watcher.observe(probe({ extraction: { outcome: 'ESCAPED', exit: 'Extracted · Goat Track' } }));
    watcher.observe(probe({ base: {} }));
    watcher.observe(probe({ extraction: { outcome: 'WIPED' } }));
    const story = log.since().filter((event) => event.kind !== 'scene' && event.kind !== 'moved');
    expect(story.map((event) => event.kind)).toEqual(['battle-start', 'battle-end', 'extracted', 'wiped']);
    expect(story[0].foe).toBe('PIDGEY');
    expect(story[1].outcome).toBe('victory');
    expect(story[2].exit).toBe('Extracted · Goat Track');
  });

  it('writes down a milestone the first time the save reaches it, and not the ones it started with', () => {
    const log = new TestEventLog();
    const watcher = new EventWatcher(log);
    watcher.progress(runProgress({ firstContractExtracted: true }));
    watcher.progress(runProgress({ firstContractExtracted: true }));
    watcher.progress(runProgress({ firstContractExtracted: true, defeatedBosses: [MISTY_BOSS_ID] }));
    watcher.progress(null);
    const milestones = log.since().filter((event) => event.kind === 'milestone');
    expect(milestones.map((event) => event.milestone)).toEqual(['misty']);
    expect(milestones[0]).toMatchObject({ label: 'Misty beaten', finished: false });
  });
});
