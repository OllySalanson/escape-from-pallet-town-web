# Brock's chalk and Bill's shelves

The next slice of the menu playtest of 31 Oct: rows 2 and 3. The key on the mat was a dark blue list; now it is the keeper talking, and what they deal in stands in the room.

- `01`: an empty workshop. Every unbuilt rung is chalked out where it will stand, traced from the art of the thing itself.
- `05`: facing a bay, Brock has quoted it and asks. It opens on NOT NOW, because YES spends materials for good.
- `06`: built. The thing stands where the chalk was, and the player is where they asked.
- `09`, `10`: the tally on his wall is the whole ladder. Left from KEEP THEM stays on it (the playtest's listed fault; `askedDealIndex`, already fixed in #425 and held here).
- `11`: a stranger's view of Bill's shelves: everything under a dust sheet.
- `12`: a partner's. Every deal he has, a thing a tile.
- `14`: a Potion: Bill names it and asks, on YES, because it is an ordinary purchase.
- `16`: a gap where a once-only deal was struck, and the first thing traded on his cabinet.
- `18`: his PC is the whole list, with the counts for buying several.
- `smallest-window-*`: 640x480, the smallest stage.

`tools/playtest/workshopBill.mjs` plays all of it by keys and by mouse and takes these. `npx vite-node tools/base/renderBase.mts -- out.png 3 --room=bills-cottage --spent=5200` draws the room without a browser.
