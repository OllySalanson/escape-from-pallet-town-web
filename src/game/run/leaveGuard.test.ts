import { describe, expect, it } from 'vitest';
import { guardLeavingDuringRaid, type LeaveTarget } from './leaveGuard';
import { RaidHeartbeat } from './raidInFlight';

/** A window that keeps its listeners, and a leave the browser is asked about. */
function standIn() {
  const listeners = new Set<(event: BeforeUnloadEvent) => void>();
  const target: LeaveTarget = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  const leave = () => {
    let prevented = false;
    const event = {
      returnValue: undefined as unknown,
      preventDefault: () => {
        prevented = true;
      },
    };
    listeners.forEach((listener) => listener(event as unknown as BeforeUnloadEvent));
    return { asked: prevented && event.returnValue === '', listeners: listeners.size };
  };
  return { target, leave, listeners };
}

describe('the question before leaving a raid', () => {
  it('is asked while a raid is under way, and never otherwise', () => {
    const page = standIn();
    let underWay = false;
    guardLeavingDuringRaid(page.target, () => underWay);

    expect(page.leave().asked).toBe(false);
    underWay = true;
    expect(page.leave().asked).toBe(true);
    underWay = false;
    expect(page.leave().asked).toBe(false);
  });

  it('stops being asked once the guard is taken down', () => {
    const page = standIn();
    const stop = guardLeavingDuringRaid(page.target, () => true);
    stop();

    expect(page.leave()).toEqual({ asked: false, listeners: 0 });
  });

  it("knows a raid is this page's from the heartbeat it starts on deploying and stops at base", () => {
    const store = new Map<string, string>();
    const heartbeat = new RaidHeartbeat(
      () => ({
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      }),
      () => 1_000,
      () => null,
    );

    expect(heartbeat.playing()).toBe(null);
    heartbeat.start('raid-1');
    expect(heartbeat.playing()).toBe('raid-1');
    heartbeat.stop();
    expect(heartbeat.playing()).toBe(null);
  });
});
