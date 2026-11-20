import { SAVE_KEY } from '../save/SaveManager';
import { readRunProgress } from './runProgress';
import {
  describeGame,
  describesForTest,
  pressMenuControl,
  sceneDescription,
  controlLabel,
  CONTROL_SELECTOR,
  type DocumentLike,
  type ElementLike,
  type SceneDescription,
  type SceneLike,
  type TestReadouts,
} from './testDescribe';
import { EventWatcher, TestEventLog } from './testEvents';

/**
 * Wires `describe()`, `eventLog()` and `pressMenu()` onto the game handle in
 * test mode (`main.ts`), and starts the event watcher on the game's own step.
 * Nothing here runs outside test mode: `main.ts` calls it only there.
 */

/** The part of `Phaser.Game` this needs. */
export interface ReadableGame {
  readonly scene: { getScenes(isActive: boolean): readonly SceneLike[] };
  readonly events: { on(event: string, handler: () => void): unknown };
}

/** How often, in frames, the watcher reads the save for milestones: the save is the one costly read. */
const SAVE_READ_EVERY = 10;

const readSave = (): string | null => {
  try {
    return window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
};

/** Running scenes bottom first, without the boot scene's empty canvas. */
const runningScenes = (game: ReadableGame): readonly SceneLike[] => [...game.scene.getScenes(true)].reverse();

export function installTestReadouts<TGame extends ReadableGame>(game: TGame): TGame & TestReadouts {
  const log = new TestEventLog();
  const watcher = new EventWatcher(log);
  const document = window.document as unknown as DocumentLike;

  const describeScene = (scenes: readonly SceneLike[]) => {
    const byKey = new Map(scenes.map((scene) => [scene.scene.key, scene]));
    return (key: string): SceneDescription | undefined => {
      const scene = byKey.get(key);
      return scene && describesForTest(scene) ? sceneDescription(scene) : undefined;
    };
  };

  game.events.on('poststep', () => {
    log.frame += 1;
    try {
      const scenes = runningScenes(game);
      watcher.observe({ scenes: scenes.map((scene) => scene.scene.key), describe: describeScene(scenes) });
      if (log.frame % SAVE_READ_EVERY === 0) {
        watcher.progress(readRunProgress(readSave()));
      }
    } catch (error) {
      log.record('error', { source: 'event watcher', message: String(error) });
    }
  });

  // A menu control pressed, by pointer or by Enter (which Chromium turns into a click).
  window.document.addEventListener(
    'click',
    (event) => {
      const target = event.target as (Element & ElementLike) | null;
      const control = target?.closest?.(CONTROL_SELECTOR) as (Element & ElementLike) | null;
      if (!control || !control.closest('.menu-overlay')) {
        return;
      }
      const heading = control.closest('.menu-overlay')?.querySelector('h1, h2, h3, [role="heading"]');
      watcher.pressed(controlLabel(control), heading?.textContent?.trim() || null);
    },
    { capture: true },
  );
  window.addEventListener('error', (event) => {
    log.record('error', { source: 'page', message: event.message, where: `${event.filename}:${event.lineno}` });
  });
  window.addEventListener('unhandledrejection', (event) => {
    log.record('error', { source: 'promise', message: String((event.reason as Error | undefined)?.message ?? event.reason) });
  });

  const readouts: TestReadouts = {
    describe: () =>
      describeGame({ scenes: runningScenes(game), document, saveText: readSave(), lastEvent: log.last }),
    // Not `events`: that is the game's own event emitter, which every scene emits on.
    eventLog: (since?: number) => log.since(since),
    pressMenu: (label: string) => pressMenuControl(document, label),
  };
  return Object.assign(game, readouts);
}
