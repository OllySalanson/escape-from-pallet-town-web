import { describe, expect, it } from 'vitest';
import { HOME_HEARTBEAT_MS, HouseDoor, KNOCK_LOOK_EVERY_MS, OUT_AFTER_MS } from './houseDoor';
import type { HarbourHouse, HouseService, KnockAtTheDoor, KnockOutcome, KnockState } from './houseService';

/** A service that keeps every call and answers what the test sets. */
class FakeService implements HouseService {
  public homes: [boolean, unknown][] = [];
  public answers: [string, boolean][] = [];
  public looks = 0;
  public knocks: KnockAtTheDoor[] = [];

  public atHome(home: boolean, snapshot: unknown): Promise<void> {
    this.homes.push([home, snapshot]);
    return Promise.resolve();
  }
  public houses(): Promise<readonly HarbourHouse[]> {
    return Promise.resolve([]);
  }
  public knock(): Promise<{ knockId: string | null; outcome: KnockOutcome }> {
    return Promise.resolve({ knockId: null, outcome: 'not-home' });
  }
  public knocksAtMyDoor(): Promise<readonly KnockAtTheDoor[]> {
    this.looks += 1;
    return Promise.resolve(this.knocks);
  }
  public answer(knockId: string, letIn: boolean): Promise<void> {
    this.answers.push([knockId, letIn]);
    return Promise.resolve();
  }
  public myKnock(): Promise<KnockState> {
    return Promise.resolve('gone');
  }
  public visit(): Promise<{ name: string; snapshot: unknown } | null> {
    return Promise.resolve(null);
  }
}

const settle = async () => {
  for (let turn = 0; turn < 3; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("the player's own front door", () => {
  it('says the player is home on the way in, with what the house looks like, and again every half a minute', async () => {
    const service = new FakeService();
    const door = new HouseDoor(service);
    door.tick(0);
    door.inside({ layout: 1 });
    await settle();
    expect(service.homes).toEqual([[true, { layout: 1 }]]);
    door.tick(HOME_HEARTBEAT_MS - 1);
    expect(service.homes).toHaveLength(1);
    door.tick(HOME_HEARTBEAT_MS);
    await settle();
    // The same house is not sent twice.
    expect(service.homes[1]).toEqual([true, null]);
  });

  it('sends the house again once it has changed', async () => {
    const service = new FakeService();
    const door = new HouseDoor(service);
    door.inside({ layout: 1 });
    await settle();
    door.inside({ layout: 2 });
    await settle();
    expect(service.homes.at(-1)).toEqual([true, { layout: 2 }]);
  });

  it('is no absence to go upstairs, and out once the player has been gone a moment', async () => {
    const service = new FakeService();
    const door = new HouseDoor(service);
    door.tick(1_000);
    door.inside({});
    door.out();
    door.tick(1_000 + OUT_AFTER_MS - 1);
    door.inside({});
    door.tick(1_000 + OUT_AFTER_MS * 3);
    expect(service.homes.some(([home]) => !home)).toBe(false);
    door.out();
    door.tick(10_000);
    door.tick(10_000 + OUT_AFTER_MS);
    await settle();
    expect(service.homes.at(-1)).toEqual([false, null]);
  });

  it('looks for knocks every few seconds, and at once when told somebody knocked', async () => {
    const service = new FakeService();
    const door = new HouseDoor(service);
    door.inside({});
    door.tick(1);
    await settle();
    expect(service.looks).toBe(1);
    door.tick(2);
    await settle();
    expect(service.looks).toBe(1);
    door.knocked();
    door.tick(3);
    await settle();
    expect(service.looks).toBe(2);
    door.tick(3 + KNOCK_LOOK_EVERY_MS);
    await settle();
    expect(service.looks).toBe(3);
  });

  it('hands over the knock at the door, and never asks about one already answered', async () => {
    const service = new FakeService();
    service.knocks = [{ knockId: 'a', knockerName: 'AMY' }];
    const door = new HouseDoor(service);
    door.inside({});
    door.tick(1);
    await settle();
    expect(door.atTheDoor).toEqual({ knockId: 'a', knockerName: 'AMY' });
    await door.answer('a', true);
    expect(service.answers).toEqual([['a', true]]);
    expect(door.atTheDoor).toBeNull();
    door.knocked();
    door.tick(2);
    await settle();
    expect(door.atTheDoor).toBeNull();
  });
});
