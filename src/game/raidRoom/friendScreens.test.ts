import { describe, expect, it } from 'vitest';
import { friendChipLines, type FriendChipFriend } from '../scenes/raidHud';
import { friendRoomCard, friendRoomView, friendStatusLine } from '../hub/friendRoomView';

describe('the friend chip', () => {
  const ash: FriendChipFriend = { name: 'ASH', atLab: false, heading: 'NE', distance: 14, elsewhere: null };
  const chip = (friends: readonly FriendChipFriend[], news: { name: string; came: boolean } | null = null) =>
    friendChipLines({ code: 'BHRK', news, friends });

  it('is the code to read out while nobody else is in', () => {
    expect(chip([])).toEqual(['ROOM BHRK']);
  });

  it('says who came and who went, before anything else', () => {
    expect(chip([ash], { name: 'ASH', came: true })).toEqual(['ASH IS IN THE ROOM']);
    expect(chip([], { name: 'ASH', came: false })).toEqual(['ASH LEFT THE RAID']);
    expect(chip([{ ...ash, name: 'BEA' }], { name: 'ASH', came: false })).toEqual(['ASH LEFT THE RAID', 'BEA NE 14']);
  });

  it('says where each friend is in the hunter chip’s own words, a line each', () => {
    expect(chip([ash])).toEqual(['ASH NE 14']);
    expect(chip([{ ...ash, distance: 1 }])).toEqual(['ASH BESIDE YOU']);
    expect(chip([{ ...ash, distance: null, elsewhere: 'indoors' }])).toEqual(['ASH INDOORS NE']);
    expect(chip([{ ...ash, heading: null, distance: null }])).toEqual(['ASH ON THE MAP']);
    expect(chip([{ ...ash, atLab: true }, { ...ash, name: 'BEA', heading: 'S', distance: 3 }])).toEqual(['ASH GETTING READY', 'BEA S 3']);
    expect(chip([{ ...ash, fighting: 'hunter' }, { ...ash, name: 'BEA', fighting: 'wild' }])).toEqual(['ASH FIGHTS THE HUNTER', 'BEA IN A FIGHT']);
    expect(chip([{ ...ash, ping: { heading: 'SE', distance: 9 } }])).toEqual(['ASH PING SE 9']);
    expect(friendChipLines({ code: 'BHRK', news: { name: '', came: true, line: 'ASH: THANKS!' }, friends: [ash] })).toEqual(['ASH: THANKS!', 'ASH NE 14']);
  });
});

describe('the lab’s raid-with-a-friend screen', () => {
  const base = { friendLine: '', maps: [{ mapId: 'floodplain-relay', name: 'Floodplain Relay' }], name: 'ME', busy: false, typed: '' };

  it('offers a room on every map the save can drop into, and a code to type', () => {
    const html = friendRoomView({ ...base, room: null });
    expect(html).toContain('data-room-map="floodplain-relay"');
    expect(html).toContain('data-room-form');
    expect(html).toContain('maxlength="4"');
  });

  it('asks for a name before anything else', () => {
    const html = friendRoomView({ ...base, room: null, name: null });
    expect(html).not.toContain('data-room-map');
    expect(html).toContain('THE BOLTHOLE');
  });

  it('shows a held room’s code, the friend’s line and the way to get ready', () => {
    const html = friendRoomView({
      ...base,
      room: { code: 'BHRK', mapName: 'Floodplain Relay', hostName: 'ASH' },
      friendLine: friendStatusLine([{ name: 'ASH', place: 'lab' }], 'BHRK', 'Floodplain Relay'),
    });
    expect(html).toContain('BHRK');
    expect(html).toContain('ASH’s room');
    expect(html).toContain('ASH is getting ready.');
    expect(html).toContain('data-room-prepare');
    expect(html).toContain('data-room-leave');
  });

  it('says on the lab’s card which room is held', () => {
    expect(friendRoomCard(null)).toContain('data-view="friend"');
    expect(friendRoomCard({ code: 'BHRK', mapName: 'Route 1' })).toContain('Room BHRK, on Route 1.');
    expect(friendStatusLine([], 'BHRK', 'Route 1')).toContain('type BHRK');
    expect(friendStatusLine([{ name: 'ASH', place: 'map:route-1' }], 'BHRK', 'Route 1')).toBe('ASH is already on Route 1.');
    const three = ['ASH', 'BEA', 'CY'].map((name) => ({ name, place: 'lab' as const }));
    expect(friendStatusLine(three, 'BHRK', 'Route 1')).toBe('ASH is getting ready. BEA is getting ready. CY is getting ready. The room is full.');
  });
});
