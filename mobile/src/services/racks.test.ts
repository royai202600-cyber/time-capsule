import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
import { answerMatches, fromServer, RackError, racks, RACK_FILTERS, RACK_PAGE, RACK_BACKEND } from './racks';

const at = { lat: 0, lng: 0, accuracy: 10 };

describe('rack sample follows HL-C1', () => {
  it('compares answers in any case with every space removed, full-width too', () => {
    expect(answerMatches(' 市　政 府 ', '市政府')).toBe(true);
    expect(answerMatches('Blue Sky', 'bluesky')).toBe(true);
    expect(answerMatches('藍', '藍色')).toBe(false);
  });
  it.skipIf(RACK_BACKEND)('pages with a { sealed_at, id } cursor passed back unchanged', async () => {
    for (let i = 0; i < 30; i++) await racks.leave('w-page', at, { body: `letter ${i}`, hint: '', wait: 1 });
    const first = await racks.list('w-page', 'mine');
    expect(first.items).toHaveLength(RACK_PAGE);
    expect(first.count).toBe(30);
    expect(first.next_cursor).toMatchObject({ id: first.items[RACK_PAGE - 1].capsule_id });
    const second = await racks.list('w-page', 'mine', first.next_cursor);
    expect(second.items).toHaveLength(6);
    expect(second.next_cursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((c) => c.capsule_id)).size).toBe(30);
  });
  it.skipIf(RACK_BACKEND)('refuses too-long text, an unknown filter, and opening your own capsule', async () => {
    await expect(racks.leave('w-x', at, { body: 'x'.repeat(281), hint: '', wait: 1 })).rejects.toMatchObject({ code: 'rejected' });
    await expect(racks.list('w-x', 'nope' as never)).rejects.toBeInstanceOf(RackError);
    const left = await racks.leave('w-x', at, { body: 'hi', hint: '', wait: 1 });
    await expect(racks.open(left.capsule_id, at)).rejects.toMatchObject({ code: 'taken' });
  });
  it.skipIf(RACK_BACKEND)('opens a ready capsule with its question answered, and returns the open_capsule row', async () => {
    const { items } = await racks.list('w-q', 'has_question');
    const ready = items.find((c) => c.ready)!;
    expect(ready.lock_question).toBeTruthy();
    await expect(racks.open(ready.capsule_id, at, '不對')).rejects.toMatchObject({ code: 'wrong_answer' });
    const opened = await racks.open(ready.capsule_id, at, '市 政府');
    expect(opened.message).toContain('答對了');
  });
});

describe('rack wire format (HL-C1 migration 20261118124925)', () => {
  it('uses the server filter names', () => {
    expect([...RACK_FILTERS]).toEqual(['all', 'ready', 'waiting', 'has_question', 'friends', 'mine']);
  });
  it("turns the server's sender portrait into the card's avatar", () => {
    const item = fromServer({ capsule_id: 'c', sender: { portrait: { set: 'illus', id: '02' }, name: 'Ken' }, hint: null, opens_at: '2026-11-20T00:00:00Z',
      ready: false, has_question: false, lock_question: null, is_friend: false, is_mine: false });
    expect(item.sender).toEqual({ id: '', name: 'Ken', avatar: { set: 'illus', id: '02' } });
  });
});
