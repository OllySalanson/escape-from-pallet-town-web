import type Phaser from 'phaser';
import type { HouseService } from '../harbour/houseService';
import {
  KNOCK_ASK_EVERY_MS,
  KNOCK_TROUBLE,
  KNOCK_WAIT_MS,
  knockOutcomeLine,
  knockScreenMarkup,
  type KnockView,
} from '../home/knocking';
import { MenuOverlay } from './MenuOverlay';
import { isOverlayDismissKey } from './overlayKeyboard';

/** Where a knock that was answered with a yes takes the player. */
export interface LetIn {
  readonly ownerId: string;
  readonly ownerName: string;
  readonly snapshot: unknown;
}

/**
 * The knock screen, opened by THE BOLTHOLE's garden sign (`home/knocking.ts`):
 * every player with a house in the harbour, and a knock on the one picked -
 * waiting at it until the owner answers, or a minute passes, or the player
 * stops. Calls back once:
 * with the house to step into if the answer was yes, else null.
 *
 * Every step asks the database (`harbour/houseService.ts`); the only thing it
 * tells another browser is a nudge to the owner's, so they look at once - and,
 * when the player stops knocking, that the knock is gone, so the owner is not
 * left answering it.
 */
export function openKnockScreen(
  scene: Phaser.Scene,
  service: HouseService,
  nudge: (owner: string, gone?: string) => void,
  onDone: (letIn: LetIn | null) => void,
): MenuOverlay {
  let settled = false;
  let view: KnockView = { kind: 'asking' };
  let waiting: number | undefined;
  let knockingOn: { id: string; name: string; knockId?: string } | null = null;

  /** Stops knocking: the owner's browser is told, so it does not ask about it. */
  const walkAway = (): void => {
    window.clearTimeout(waiting);
    if (knockingOn?.knockId) {
      nudge(knockingOn.id, knockingOn.knockId);
    }
    knockingOn = null;
  };

  const settle = (letIn: LetIn | null): void => {
    if (settled) {
      return;
    }
    settled = true;
    if (letIn) {
      window.clearTimeout(waiting);
    } else {
      walkAway();
    }
    overlay.destroy();
    onDone(letIn);
  };
  const render = (): void => {
    overlay.root.innerHTML = knockScreenMarkup(view);
    overlay.root.querySelector<HTMLButtonElement>('[data-knock-close]')!.onclick = () => settle(null);
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-knock]').forEach((row) => {
      row.onclick = () => knock(row.dataset.knock ?? '', row.dataset.name ?? '');
    });
    overlay.refocus('[data-cursor-start]', '[data-knock-close]');
  };
  const showHouses = (status?: string): void => {
    knockingOn = null;
    view = { kind: 'asking' };
    render();
    service.houses().then(
      (houses) => {
        if (settled || knockingOn) {
          return;
        }
        view = { kind: 'houses', houses, ...(status ? { status } : {}) };
        render();
      },
      () => {
        if (!settled) {
          view = { kind: 'trouble' };
          render();
        }
      },
    );
  };
  const knock = (owner: string, name: string): void => {
    if (knockingOn || !owner) {
      return;
    }
    knockingOn = { id: owner, name };
    view = { kind: 'knocking', name };
    render();
    service.knock(owner).then(
      ({ knockId, outcome }) => {
        if (settled || knockingOn?.id !== owner) {
          return;
        }
        if (outcome !== 'knocking' || !knockId) {
          showHouses(knockOutcomeLine(name, outcome === 'knocking' ? 'gone' : outcome));
          return;
        }
        knockingOn = { id: owner, name, knockId };
        nudge(owner);
        waitFor(knockId, owner, name, performance.now());
      },
      () => showHouses(KNOCK_TROUBLE),
    );
  };
  const waitFor = (knockId: string, owner: string, name: string, since: number): void => {
    waiting = window.setTimeout(() => {
      service.myKnock(knockId).then(
        (state) => {
          if (settled || knockingOn?.id !== owner) {
            return;
          }
          if (state === 'waiting' && performance.now() - since < KNOCK_WAIT_MS) {
            waitFor(knockId, owner, name, since);
            return;
          }
          if (state !== 'in') {
            showHouses(knockOutcomeLine(name, state === 'waiting' ? 'gone' : state));
            return;
          }
          service.visit(owner).then(
            (house) => (house ? settle({ ownerId: owner, ownerName: house.name, snapshot: house.snapshot }) : showHouses(KNOCK_TROUBLE)),
            () => showHouses(KNOCK_TROUBLE),
          );
        },
        () => showHouses(KNOCK_TROUBLE),
      );
    }, KNOCK_ASK_EVERY_MS);
  };

  const overlay: MenuOverlay = new MenuOverlay(scene, 'knock-menu pixel-ui', (event) => {
    if (isOverlayDismissKey(event)) {
      event.preventDefault();
      if (knockingOn) {
        // Stopping is walking away from the door, not leaving the screen.
        walkAway();
        showHouses('You stopped knocking.');
      } else {
        settle(null);
      }
      return;
    }
    if (overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  });
  overlay.root.setAttribute('aria-label', 'Knock on a door');
  showHouses();
  return overlay;
}
