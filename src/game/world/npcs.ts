import type { Direction, GridPosition } from '../movement/gridMovement';

export type WorldEntityKind = 'npc' | 'sign';

export interface WorldEntity {
  id: string;
  kind: WorldEntityKind;
  position: GridPosition;
  facing: Direction;
  dialogLines: readonly string[];
}

export const WORLD_ENTITIES: readonly WorldEntity[] = [
  {
    id: 'route-guide',
    kind: 'npc',
    position: { x: 5, y: 8 },
    facing: 'right',
    dialogLines: [
      'Pallet Town is small, but every great journey starts somewhere.',
      'The tall grass is waiting just beyond town!',
    ],
  },
  {
    id: 'pond-watcher',
    kind: 'npc',
    position: { x: 10, y: 12 },
    facing: 'up',
    dialogLines: [
      'I could watch the pond ripple all day.',
      'The fence keeps everyone a safe distance from the water.',
    ],
  },
  {
    id: 'town-sign',
    kind: 'sign',
    position: { x: 9, y: 8 },
    facing: 'down',
    dialogLines: ['PALLET TOWN', 'A town of new beginnings.'],
  },
];

export function getWorldEntityAt(position: GridPosition): WorldEntity | undefined {
  return WORLD_ENTITIES.find(
    (entity) => entity.position.x === position.x && entity.position.y === position.y,
  );
}
