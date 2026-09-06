import type { StorageLike } from '../save/SaveManager';

export const TEST_LAB_STORAGE_KEY = 'escape-from-pallet-town.test-lab.v1';

export type TestLabResult = 'not-tested' | 'pass' | 'fail';

export interface TestLabScenario {
  readonly id: string;
  readonly title: string;
  readonly setup: string;
  readonly expected: string;
  readonly route: 'base' | 'run-town' | 'run-south' | 'battle';
}

export interface TestLabRecord {
  readonly result: TestLabResult;
  readonly notes: string;
}

export const TEST_LAB_SCENARIOS: readonly TestLabScenario[] = [
  {
    id: 'first-deployment',
    title: 'First deployment',
    setup: 'Fresh profile at Base.',
    expected: 'Starter and field-kit contract are ready.',
    route: 'base',
  },
  {
    id: 'safe-extraction',
    title: 'Safe extraction',
    setup: 'Fixed Town Square raid.',
    expected: 'Extracted haul reaches the Base stash.',
    route: 'run-town',
  },
  {
    id: 'reload-base',
    title: 'Reload to base',
    setup: 'Fresh profile, then reload.',
    expected: 'Reload enters Base, never resumes a raid.',
    route: 'base',
  },
  {
    id: 'redeploy-spawn',
    title: 'Redeployment spawn',
    setup: 'South Verge fixed raid.',
    expected: 'Run begins at the selected insertion.',
    route: 'run-south',
  },
  {
    id: 'field-station-cache',
    title: 'Field Station cache',
    setup: 'Fixed Town Square raid.',
    expected: 'Field Station cache is usable once per raid.',
    route: 'run-town',
  },
  {
    id: 'battle-attribution',
    title: 'Battle action attribution',
    setup: 'Charmander vs Bulbasaur.',
    expected: 'Battle messages name the Pokémon and move used.',
    route: 'battle',
  },
  {
    id: 'long-text',
    title: 'Long objective / move text',
    setup: 'South Verge fixed raid.',
    expected: 'Long copy remains readable without clipping.',
    route: 'run-south',
  },
  {
    id: 'pp-persistence',
    title: 'PP persistence',
    setup: 'Charmander vs Bulbasaur.',
    expected: 'Used move PP remains correct through battle flow.',
    route: 'battle',
  },
  {
    id: 'battle-return',
    title: 'Battle return location',
    setup: 'Town Square raid encounter.',
    expected: 'Battle returns to the exact overworld tile.',
    route: 'run-town',
  },
];

export class TestLabStore {
  private readonly storage: StorageLike | null;

  public constructor(storage: StorageLike | null = getBrowserStorage()) {
    this.storage = storage;
  }

  public load(): Record<string, TestLabRecord> {
    if (!this.storage) return {};
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(TEST_LAB_STORAGE_KEY) ?? '{}');
      if (!isRecord(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed).flatMap(([id, value]) =>
          isRecord(value) && isResult(value.result) && typeof value.notes === 'string'
            ? [[id, { result: value.result, notes: value.notes }]]
            : [],
        ),
      );
    } catch {
      return {};
    }
  }

  public save(records: Record<string, TestLabRecord>): boolean {
    try {
      this.storage?.setItem(TEST_LAB_STORAGE_KEY, JSON.stringify(records));
      return this.storage !== null;
    } catch {
      return false;
    }
  }

  public reset(): void {
    try {
      this.storage?.removeItem(TEST_LAB_STORAGE_KEY);
    } catch {
      // The lab must remain usable when browser storage is unavailable.
    }
  }
}

function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isResult(value: unknown): value is TestLabResult {
  return value === 'not-tested' || value === 'pass' || value === 'fail';
}
