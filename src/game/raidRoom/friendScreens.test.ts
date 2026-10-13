import { describe, expect, it } from 'vitest';
import { friendChipLine } from '../scenes/raidHud';
import { friendRoomCard, friendRoomView, friendStatusLine } from '../hub/friendRoomView';

describe('the friend chip', () => {
  const friend = { name: 'ASH', atLab: false, heading: 'NE', distance: 14, elsewhere: null };

  it('is the code to read out while nobody else is in', () => {
    expect(friendChipLine({ code: 'BHRK', news: null, friend: null })).toBe('ROOM BHRK');
  });

  it('says who came and who went, before anything else', () => {
    expect(friendChipLine({ code: 'BHRK', news: { name: 'ASH', came: true }, friend })).toBe('ASH IS IN THE ROOM');
    expect(friendChipLine({ code: 'BHRK', news: { name: 'ASH', came: false }, friend: null })).toBe('ASH LEFT THE RAID');
  });

  it('says where the friend is in the hunter chip’s own words', () => {
    expect(friendChipLine({ code: 'BHRK', news: null, friend })).toBe('ASH NE 14');
    expect(friendChipLine({ code: 'BHRK', news: null, friend: { ...friend, distance: 1 } })).toBe('ASH BESIDE YOU');
    expect(friendChipLine({ code: 'BHRK', news: null, friend: { ...friend, distance: null, elsewhere: 'indoors' } })).toBe('ASH INDOORS NE');
    expect(friendChipLine({ code: 'BHRK', news: null, friend: { ...friend, heading: null, distance: null } })).toBe('ASH ON THE MAP');
    expect(friendChipLine({ code: 'BHRK', news: null, friend: { ...friend, atLab: true } })).toBe('ASH GETTING READY');
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
      friendLine: friendStatusLine({ name: 'ASH', place: 'lab' }, 'BHRK', 'Floodplain Relay'),
    });
    expect(html).toContain('BHRK');
    expect(html).toContain('ASH’s room');
    expect(html).toContain('ASH is in the room, getting ready.');
    expect(html).toContain('data-room-prepare');
    expect(html).toContain('data-room-leave');
  });

  it('says on the lab’s card which room is held', () => {
    expect(friendRoomCard(null)).toContain('data-view="friend"');
    expect(friendRoomCard({ code: 'BHRK', mapName: 'Route 1' })).toContain('Room BHRK on Route 1');
    expect(friendStatusLine(null, 'BHRK', 'Route 1')).toContain('types BHRK');
    expect(friendStatusLine({ name: 'ASH', place: 'map:route-1' }, 'BHRK', 'Route 1')).toBe('ASH is already on Route 1.');
  });
});
