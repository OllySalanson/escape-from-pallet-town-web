import { describe, expect, it } from 'vitest';
import { AWAY_GRACE_MS, GREET_EVERY_MS, HarbourLink, LEAVE_AFTER_MS, type HarbourHeard, type HarbourWire } from './harbourLink';
import { HARBOUR_SEND_EVERY_MS, type HarbourMove, type HarbourNudge, type HarbourPlace } from './harbourProtocol';

const ME = '11111111-1111-4111-8111-111111111111';
const AMY = '22222222-2222-4222-8222-222222222222';
const NOBODY = '33333333-3333-4333-8333-333333333333';

/** A wire that keeps everything it is asked to do, and lets a test speak for the others. */
class FakeWire implements HarbourWire {
  public joinedAs: (string | null)[] = [];
  public sent: HarbourMove[] = [];
  public nudged: HarbourNudge[] = [];
  public stood: (HarbourPlace | null)[] = [];
  public left = 0;
  public known = new Map<string, string>([[AMY, 'AMY']]);
  private heard: HarbourHeard | null = null;

  public join(as: string | null, _place: HarbourPlace | null, heard: HarbourHeard): Promise<boolean> {
    this.joinedAs.push(as);
    this.heard = heard;
    return Promise.resolve(true);
  }
  public standIn(place: HarbourPlace | null): void {
    this.stood.push(place);
  }
  public send(move: HarbourMove): void {
    this.sent.push(move);
  }
  public nudge(nudge: HarbourNudge): void {
    this.nudged.push(nudge);
  }
  public hearNudge(nudge: HarbourNudge): void {
    this.heard?.nudge(nudge);
  }
  public names(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(new Map(ids.flatMap((id) => (this.known.has(id) ? [[id, this.known.get(id)!] as const] : []))));
  }
  public leave(): Promise<void> {
    this.left += 1;
    return Promise.resolve();
  }
  public present(members: [string, HarbourPlace][]): void {
    this.heard?.present(new Map(members));
  }
  public move(move: HarbourMove): void {
    this.heard?.move(move);
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function joined(me: string | null = ME): Promise<{ link: HarbourLink; wire: FakeWire }> {
  const wire = new FakeWire();
  const link = new HarbourLink(wire);
  link.enter(me, me ? 'yard' : null, { x: 16, y: 13 }, 'up');
  await settle();
  return { link, wire };
}

describe("this browser's place in the shared harbour", () => {
  it('watches without being seen until it has a named house', async () => {
    const { link, wire } = await joined(null);
    expect(wire.joinedAs).toEqual([null]);
    wire.present([[AMY, 'yard']]);
    link.stepped({ x: 16, y: 12 }, 'up');
    link.tick(1_000, 16);
    expect(wire.sent).toEqual([]);
  });

  it('sends nothing at all while nobody else is there to see it', async () => {
    const { link, wire } = await joined();
    wire.present([[ME, 'yard']]);
    link.stepped({ x: 16, y: 12 }, 'up');
    link.tick(1_000, 16);
    expect(wire.sent).toEqual([]);
  });

  it('says once where it stands when somebody arrives, then sends its steps a few at a time', async () => {
    const { link, wire } = await joined();
    wire.present([[ME, 'yard'], [AMY, 'yard']]);
    link.tick(10_000, 16);
    expect(wire.sent).toEqual([{ from: ME, place: 'yard', path: [{ x: 16, y: 13 }], facing: 'up' }]);
    link.stepped({ x: 16, y: 12 }, 'up');
    link.stepped({ x: 16, y: 11 }, 'up');
    link.tick(10_000 + HARBOUR_SEND_EVERY_MS - 1, 16);
    expect(wire.sent).toHaveLength(1);
    link.tick(10_000 + HARBOUR_SEND_EVERY_MS, 16);
    expect(wire.sent[1]).toEqual({
      from: ME,
      place: 'yard',
      path: [{ x: 16, y: 12 }, { x: 16, y: 11 }],
      facing: 'up',
    });
  });

  it('greets a crowd of arrivals once, not once each', async () => {
    const { link, wire } = await joined();
    wire.present([[ME, 'yard'], [AMY, 'yard']]);
    link.tick(10_000, 16);
    wire.present([[ME, 'yard'], [AMY, 'yard'], [NOBODY, 'yard']]);
    link.tick(10_000 + 10, 16);
    expect(wire.sent).toHaveLength(1);
    link.tick(10_000 + GREET_EVERY_MS, 16);
    expect(wire.sent).toHaveLength(2);
  });

  it('draws only the players the database has a name for, never itself', async () => {
    const { link, wire } = await joined();
    wire.present([[ME, 'yard'], [AMY, 'yard'], [NOBODY, 'yard']]);
    await settle();
    for (const from of [ME, AMY, NOBODY]) {
      wire.move({ from, place: 'yard', path: [{ x: 5, y: 9 }], facing: 'down' });
    }
    link.tick(1, 16);
    expect(link.figuresIn('yard').map((figure) => [figure.id, figure.name])).toEqual([[AMY, 'AMY']]);
    expect(link.othersHere).toBe(1);
  });

  it('stops drawing somebody once they have left', async () => {
    const { link, wire } = await joined();
    wire.present([[ME, 'yard'], [AMY, 'yard']]);
    await settle();
    wire.move({ from: AMY, place: 'yard', path: [{ x: 5, y: 9 }], facing: 'down' });
    wire.present([[ME, 'yard']]);
    expect(link.figuresIn('yard')).toEqual([]);
  });

  it('says it is not standing anywhere once its scene has been gone a moment, and leaves after a minute', async () => {
    const { link, wire } = await joined();
    link.tick(1_000, 16);
    link.away();
    link.tick(1_000 + AWAY_GRACE_MS - 1, 16);
    expect(wire.stood).toEqual([]);
    link.tick(1_000 + AWAY_GRACE_MS, 16);
    expect(wire.stood).toEqual([null]);
    link.tick(1_000 + AWAY_GRACE_MS + LEAVE_AFTER_MS, 16);
    expect(wire.left).toBe(1);
  });

  it('walking through a door in the grace is no absence at all', async () => {
    const { link, wire } = await joined();
    link.tick(1_000, 16);
    link.away();
    link.enter(ME, 'oaks-lab', { x: 7, y: 9 }, 'up');
    link.tick(1_000 + AWAY_GRACE_MS * 2, 16);
    expect(wire.stood).toEqual(['oaks-lab']);
  });

  it('nudges another browser only as a player who can be heard, and hears only nudges meant for it', async () => {
    const watching = await joined(null);
    watching.link.nudge(AMY);
    expect(watching.wire.nudged).toEqual([]);
    const { link, wire } = await joined();
    const heard: string[] = [];
    link.whenNudged((from) => heard.push(from));
    link.nudge(AMY);
    expect(wire.nudged).toEqual([{ from: ME, to: AMY }]);
    wire.hearNudge({ from: AMY, to: NOBODY });
    wire.hearNudge({ from: AMY, to: ME });
    expect(heard).toEqual([AMY]);
  });

  it('tells the owner a knock is gone, and hands the owner which one', async () => {
    const { link, wire } = await joined();
    const heard: [string, string | undefined][] = [];
    link.whenNudged((from, gone) => heard.push([from, gone]));
    link.nudge(AMY, 'knock-id');
    expect(wire.nudged).toEqual([{ from: ME, to: AMY, gone: 'knock-id' }]);
    wire.hearNudge({ from: AMY, to: ME, gone: 'knock-id' });
    wire.hearNudge({ from: AMY, to: ME });
    expect(heard).toEqual([
      [AMY, 'knock-id'],
      [AMY, undefined],
    ]);
  });

  it('joins again as the player when the name was written while the first join was on its way', async () => {
    const wire = new FakeWire();
    let answer: (ok: boolean) => void = () => undefined;
    const first = wire.join.bind(wire);
    wire.join = (as, place, heard) => {
      void first(as, place, heard);
      return new Promise<boolean>((resolve) => {
        answer = resolve;
      });
    };
    const link = new HarbourLink(wire);
    link.enter(null, null, { x: 16, y: 13 }, 'up');
    link.enter(ME, 'yard', { x: 16, y: 13 }, 'up');
    wire.join = first;
    answer(true);
    await settle();
    await settle();
    expect(wire.left).toBe(1);
    expect(wire.joinedAs).toEqual([null, ME]);
  });

  it('joins again as the player once it has signed in and named a house', async () => {
    const { link, wire } = await joined(null);
    link.enter(ME, 'yard', { x: 16, y: 13 }, 'up');
    await settle();
    await settle();
    expect(wire.left).toBe(1);
    expect(wire.joinedAs).toEqual([null, ME]);
  });
});

describe('the partner at this player\'s heel, as the others are told', () => {
  it('goes with every move once it is carried', async () => {
    const { link, wire } = await joined();
    link.carry('charmander');
    wire.present([[ME, 'yard'], [AMY, 'yard']]);
    link.tick(10_000, 16);
    expect(wire.sent[0]).toEqual({ from: ME, place: 'yard', path: [{ x: 16, y: 13 }], facing: 'up', partner: 'charmander' });
    link.stepped({ x: 16, y: 12 }, 'up');
    link.tick(10_000 + HARBOUR_SEND_EVERY_MS, 16);
    expect(wire.sent[1]?.partner).toBe('charmander');
  });

  it('is said at once to anybody here when it changes, and not when it does not', async () => {
    const { link, wire } = await joined();
    wire.present([[ME, 'yard'], [AMY, 'yard']]);
    link.tick(10_000, 16);
    const greeted = wire.sent.length;
    link.carry('charmeleon');
    expect(wire.sent).toHaveLength(greeted + 1);
    expect(wire.sent[greeted]?.partner).toBe('charmeleon');
    link.carry('charmeleon');
    expect(wire.sent).toHaveLength(greeted + 1);
    link.carry(null);
    expect(wire.sent[greeted + 1]).not.toHaveProperty('partner');
  });

  it('is not said to an empty harbour', async () => {
    const { link, wire } = await joined();
    wire.present([[ME, 'yard']]);
    link.carry('bulbasaur');
    expect(wire.sent).toEqual([]);
  });
});
