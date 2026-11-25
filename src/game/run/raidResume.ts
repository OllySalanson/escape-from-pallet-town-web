import type { SaveManager } from '../save/SaveManager';
import { raidResumePlanPrefix } from '../save/SaveManager';
import type { PrimaryStatus } from '../pokemon/battle/status';
import type { ActiveRunSession } from './RunSession';
import type { RaidCarriage } from './raidCarriage';
import { raidHeartbeat, takenUpRaidId } from './raidInFlight';
import { objectivesForContract } from '../objectives/RunObjectives';
import type { RunPlan } from './runGeneration';
import { decodeRaidSnapshot, encodeRaidSnapshot, type RaidSnapshotGraph } from './raidSnapshot';

/**
 * A raid survives the page it is played in.
 *
 * A raid used to live only in memory, so a reload, a crash or a tab the browser
 * threw away to save memory was settled as abandoned and cost the pack (the
 * critic's review, problem 2) - and the same gap was a way out of anything going
 * wrong, a losing fight included, for anybody who pressed F5 (problem 44). Now
 * the raid is written down as it is played and taken up again where it stood.
 *
 * The rules, which are what make it impossible to use as an undo:
 *
 * 1. **What is written is the whole raid**: everything a fight carries through
 *    (`RaidCarriage`, the run session, the clock, the hunters) and the raid's
 *    own random streams where they have got to, so a step retraced after a
 *    reload meets what it met before. It is written beside the save, never in
 *    it, and only while the save still holds that raid in flight.
 * 2. **It is never behind anything that cannot be taken back.** A fight is
 *    written as it starts, so a reload in the grass puts the player back in
 *    that fight, never on the tile before it. Each turn is written the moment
 *    it is resolved, before a line of it is shown, so a turn seen going badly
 *    cannot be chosen again. A turn that loses the fight is written as lost,
 *    and taken up it is the wipe it was. The walk between is written about once
 *    a second and whenever the page is hidden, reloaded or frozen, so the most a
 *    crash costs is a second of walking - and it costs the clock that second
 *    back with it, so nothing is gained.
 * 3. **One page plays a raid.** A raid being played in another window is left
 *    to that window, as before; a page that takes a raid up gives it a new id,
 *    so a window that was only frozen and wakes finds its raid settled
 *    elsewhere and stops, rather than playing it twice.
 * 4. **A record that cannot be trusted is not taken up.** One from another
 *    version of the record, for another raid, that will not read back, or that
 *    could not be brought up to date when it was last written (it is taken away
 *    then) is settled as abandoned, exactly as before there was a record.
 *
 * What a fight taken up cannot keep is what lives only on the field: stat
 * stages, confusion, a seed sown. Both sides lose those alike, and both come
 * back with the HP, status and PP the last resolved turn left them.
 */

/** The shape of the record. A record of any other shape is not taken up. */
export const RAID_RESUME_VERSION = 1;

/** How often the walk is written down, at most, while the raid is being played. */
export const RAID_RESUME_EVERY_MS = 1_000;

/** What a resolved turn left a Pokemon on the other side with. */
export interface FoeState {
  readonly hp: number;
  readonly status: PrimaryStatus | null;
  readonly sleepTurns: number;
  readonly pp: readonly number[];
}

/** Which screen the raid was on, and so which one it is taken up on. */
export type ResumeScene = 'world' | 'battle';

interface RaidResumeRecord {
  readonly v: number;
  readonly raidId: string;
  readonly scene: ResumeScene;
  readonly data: RaidSnapshotGraph;
  /** The other side of a fight, in the order the fight holds it. */
  readonly foes?: readonly FoeState[];
}

interface RaidPlanRecord {
  readonly raidId: string;
  readonly graph: RaidSnapshotGraph;
}

/** A scene's payload with a raid in it: the world's, or a fight's. */
type RaidPayload = Partial<RaidCarriage> & object;

/** A raid read back, ready to be started on the scene it was on. */
export interface TakenUpRaid {
  readonly scene: ResumeScene;
  readonly data: RaidPayload & { readonly runSession: ActiveRunSession };
  readonly foes?: readonly FoeState[];
}

/**
 * Writes the raid down. False when nothing was written: no raid id (the
 * explorer's walk, a maker's try), the save no longer holds the raid, or
 * storage refused it. Never throws: a raid that cannot be written down is still
 * played, and settled as abandoned if the page goes.
 */
export function writeRaidResume(
  saves: SaveManager,
  scene: ResumeScene,
  data: RaidPayload,
  foes?: readonly FoeState[],
): boolean {
  const session = data.runSession;
  const raidId = session?.raidId;
  if (!session || raidId === undefined) {
    return false;
  }
  try {
    const plan = session.plan;
    // The plan is written once a raid, and the objectives - which carry the
    // rule each is measured by - are the plan's contract's, read back from it.
    if (!sameIds(session.objectives, objectivesOf(plan))) {
      throw new Error('This raid\'s objectives are not its contract\'s, and could not be read back.');
    }
    const named = new Map<object, string>([
      ...(plan ? [[plan, 'plan'] as const] : []),
      [session.objectives, 'objectives'] as const,
    ]);
    const record: RaidResumeRecord = {
      v: RAID_RESUME_VERSION,
      raidId,
      scene,
      data: encodeRaidSnapshot(data, named),
      ...(foes === undefined ? {} : { foes }),
    };
    return saves.writeRaidResume(raidId, JSON.stringify(record), () => {
      const written: RaidPlanRecord = { raidId, graph: encodeRaidSnapshot(plan ?? null) };
      return JSON.stringify(written);
    });
  } catch (error) {
    // Something in the raid nobody said how to write: it is played on, and the
    // stale record is not left to be taken up.
    console.error(error);
    saves.clearRaidResume();
    return false;
  }
}

/**
 * Reads the raid in flight back, if it was written down and can be trusted,
 * and hands it to this page: a new id for the raid, and this page's heartbeat
 * for it. Null when there is nothing to take up, and then the raid in flight
 * (if any) is the base's to settle as abandoned, as it always was.
 *
 * `liveElsewhere` is asked first: a raid another window is playing is that
 * window's.
 */
export function takeUpRaid(saves: SaveManager, liveElsewhere: (raidId: string) => boolean): TakenUpRaid | null {
  const raid = saves.load()?.raidInFlight;
  if (!raid) {
    saves.clearRaidResume();
    return null;
  }
  if (liveElsewhere(raid.id)) {
    return null;
  }
  const written = saves.readRaidResume();
  const read = written ? readRecords(written.record, written.plan, raid.id) : null;
  if (!read) {
    saves.clearRaidResume();
    return null;
  }
  const newId = takenUpRaidId(raid.id);
  if (!saves.handOverRaidInFlight(raid.id, newId)) {
    return null;
  }
  // The session is the raid's one object, carried through every fight: its id
  // is what every ending settles, so it is the new one from here.
  (read.data.runSession as { raidId?: string }).raidId = newId;
  raidHeartbeat.start(newId, () => saves.raidInFlightId() === newId);
  // Written again at once under the new id, so a second reload takes this up.
  writeRaidResume(saves, read.scene, read.data, read.foes);
  return read;
}

/**
 * What a raid's ending tells its result screen when the save no longer holds
 * it: settled elsewhere, and whether that was another window taking it up
 * where this one left it rather than settling it as abandoned.
 */
export function elsewhereFacts(
  settledElsewhere: boolean,
  raidId: string | undefined,
  saves: SaveManager,
): { settledElsewhere?: true; takenUpElsewhere?: true } {
  if (!settledElsewhere) {
    return {};
  }
  return saves.raidTakenUpElsewhere(raidId) ? { settledElsewhere: true, takenUpElsewhere: true } : { settledElsewhere: true };
}

function objectivesOf(plan: RunPlan | undefined): ActiveRunSession['objectives'] {
  return plan?.contract ? objectivesForContract(plan.contract) : [];
}

function sameIds(a: readonly { readonly id: string }[], b: readonly { readonly id: string }[]): boolean {
  return a.length === b.length && a.every((each, index) => each.id === b[index]?.id);
}

function readRecords(recordText: string, planText: string, raidId: string): TakenUpRaid | null {
  try {
    if (!planText.startsWith(raidResumePlanPrefix(raidId))) {
      return null;
    }
    const record = JSON.parse(recordText) as Partial<RaidResumeRecord>;
    if (
      record.v !== RAID_RESUME_VERSION ||
      record.raidId !== raidId ||
      (record.scene !== 'world' && record.scene !== 'battle') ||
      typeof record.data !== 'object' ||
      record.data === null
    ) {
      return null;
    }
    const plan = JSON.parse(planText) as RaidPlanRecord;
    const decodedPlan = decodeRaidSnapshot(plan.graph) as RunPlan | null;
    const data = decodeRaidSnapshot(record.data, {
      plan: decodedPlan,
      objectives: objectivesOf(decodedPlan ?? undefined),
    }) as RaidPayload;
    const session = data.runSession;
    if (!session || session.raidId !== raidId || !data.party || !data.bag || !data.returnLocation) {
      return null;
    }
    return {
      scene: record.scene,
      data: data as TakenUpRaid['data'],
      ...(Array.isArray(record.foes) ? { foes: record.foes } : {}),
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Whoever is playing the raid in this page, asked to write it down when the
 * page is about to go: hidden (where a browser may throw it away to save
 * memory), frozen, or unloaded.
 */
let writer: (() => void) | null = null;
let listening = false;

/** Stops `write` being asked, if it is still the one asked: a scene going hands over to the next. */
export function clearRaidResumeWriter(write: () => void): void {
  if (writer === write) {
    writer = null;
  }
}

/** Says who writes the raid down when the page goes; null when nobody is playing one here. */
export function setRaidResumeWriter(write: (() => void) | null): void {
  writer = write;
  if (listening || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  listening = true;
  const now = (): void => writer?.();
  window.addEventListener('pagehide', now);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      now();
    }
  });
  document.addEventListener('freeze', now);
}
