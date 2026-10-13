import { COLUMN_MEASURES, escapeAttribute, pixelColumns, pixelCommitBar, pixelWindow } from '../ui/pixelUi';
import { ROOM_CODE_LENGTH, ROOM_SIZE } from '../raidRoom/roomCode';
import type { RaidPlace } from '../raidRoom/raidProtocol';

/**
 * RAID WITH A FRIEND, in Oak's Lab: what the screen says, Phaser-free.
 *
 * Two things can be done with no room held - make one on a map you can drop
 * into, or type a friend's code - and with a room held, one thing: get ready
 * and go. A room is a map and nothing else; the raid itself is prepared
 * exactly as one alone is (`hub/deploymentFlow.ts`), with the drop-in held to
 * the room's map.
 */

/** A map a room can be made on: one this save can drop into. */
export interface RoomMapChoice {
  readonly mapId: string;
  readonly name: string;
}

export interface FriendRoomScreen {
  /** The room held, if any, with its map's name. */
  readonly room: {
    readonly code: string;
    readonly mapName: string;
    readonly hostName: string | null;
  } | null;
  /** The friend's line, while a room is held (`friendStatusLine`). */
  readonly friendLine: string;
  /** The maps a room can be made on. */
  readonly maps: readonly RoomMapChoice[];
  /** The name this player raids under, or null if they have none yet. */
  readonly name: string | null;
  /** Whether the database is being asked something right now. */
  readonly busy: boolean;
  /** What is typed in the code field. */
  readonly typed: string;
}

/** What the screen says about everybody else in the room, as the room's channel has them. */
export function friendStatusLine(
  friends: readonly { readonly name: string; readonly place: RaidPlace }[],
  code: string,
  mapName: string,
): string {
  if (friends.length === 0) {
    return `Nobody else is in yet. Your friends type ${code} under Raid with a friend.`;
  }
  const each = friends
    .map((friend) => (friend.place === 'lab' ? `${friend.name} is getting ready.` : `${friend.name} is already on ${mapName}.`))
    .join(' ');
  return friends.length + 1 >= ROOM_SIZE ? `${each} The room is full.` : each;
}

/** The lab's card for it: what a press there opens. */
export function friendRoomCard(room: { readonly code: string; readonly mapName: string } | null): string {
  // One short line, because at the smallest stage a third card is room the
  // contract board under it gives up.
  const line = room ? `Room ${room.code}, on ${room.mapName}.` : 'Make a room, or type a friend’s code.';
  return `<button class="px-window px-card hub-friend" data-view="friend" data-help="Two players on one map, each with their own team, pack and clock."><strong>Raid with a friend</strong><p>${line}</p></button>`;
}

export function friendRoomView(screen: FriendRoomScreen): string {
  if (!screen.name) {
    return `<main class="px-body friend-layout">${pixelWindow(
      '<p class="px-wrap">A friend sees you by your name, and you have not chosen one yet. Walk into THE BOLTHOLE, your house at the end of the row, and it will ask.</p>',
      { heading: 'Choose your name first' },
    )}</main>`;
  }
  return screen.room ? heldView(screen, screen.room) : choosingView(screen);
}

function choosingView(screen: FriendRoomScreen): string {
  const disabled = screen.busy ? ' aria-disabled="true"' : '';
  const maps = screen.maps
    .map(
      (map, index) =>
        `<button class="px-row" data-room-map="${escapeAttribute(map.mapId)}"${index === 0 ? ' data-cursor-start' : ''}${disabled} data-help="${escapeAttribute(`Make a room on ${map.name}. Your friends drop in there too.`)}"><span class="px-row-main"><strong class="px-name">${map.name}</strong></span></button>`,
    )
    .join('');
  const make = pixelWindow(
    `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.line)}>${maps}</div>`,
    { className: 'friend-make', heading: 'Make a room', note: 'on a map you know' },
  );
  const join = pixelWindow(
    `<form class="box-bar box-form friend-join" data-room-form><input class="px-window px-field" name="code" value="${escapeAttribute(screen.typed)}" maxlength="${ROOM_CODE_LENGTH}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Room code" placeholder="CODE" /><button type="submit" class="px-window px-chip"${disabled} data-help="Join the room with this code.">Join</button></form><p class="px-note px-wrap">Four letters, read out by whoever made the room.</p>`,
    { className: 'friend-join-window', heading: 'Join a friend' },
  );
  return `<main class="px-body friend-layout">${make}${join}${pixelWindow(
    `<p class="px-wrap">Up to four of you on one map. You each bring your own team and pack, keep your own clock and loot, and fight your own fights. You see each other walk, and leave by any exit alone.</p>`,
    { className: 'friend-about', heading: 'Together, apart' },
  )}</main>`;
}

function heldView(screen: FriendRoomScreen, room: NonNullable<FriendRoomScreen['room']>): string {
  const whose = room.hostName ? `${room.hostName}’s room` : 'Your room';
  return `<main class="px-body friend-layout is-held">${pixelWindow(
    `<p class="friend-code" data-room-code>${room.code}</p><p class="px-wrap">${room.hostName ? `You are in ${room.hostName}’s room.` : 'Read this code to up to three friends.'} The raid is on ${room.mapName}.</p><p class="px-wrap" data-room-friend aria-live="polite">${screen.friendLine}</p>`,
    { className: 'friend-room', heading: whose, note: room.mapName },
  )}${pixelCommitBar({
    title: `Raid ${room.mapName} together`,
    lines: ['<small class="px-wrap">Get ready as for any raid. You drop in when you are ready, not together.</small>'],
    actions: `<button class="px-window px-button" data-room-leave data-help="Leave the room. Anybody else in it raids on without you.">Leave the room</button><button class="px-window px-button is-primary" data-room-prepare data-cursor-start data-help="Build a loadout for ${escapeAttribute(room.mapName)}.">Get ready</button>`,
  })}</main>`;
}
