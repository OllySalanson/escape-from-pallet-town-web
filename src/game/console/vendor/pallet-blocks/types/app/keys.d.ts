import type { GameAction } from '../core/game';
export declare function gameActionFor(code: string): GameAction | null;
export type MenuKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';
export declare function menuKeyFor(code: string): MenuKey | null;
export declare const isPauseKey: (code: string) => boolean;
export declare const isMuteKey: (code: string) => boolean;
