import { describe, expect, it, vi } from 'vitest';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) } }));
vi.mock('./supabase', () => ({ supabase: {} }));
import { keeperMark, readyToReturn, type Hunt } from './cityHunt';
import type { Quest } from './quests';

const hunt = { checked_in_at: '2026-11-19T01:00:00Z', finished_at: null, joined_at: '2026-11-19T00:00:00Z',
  quests: [{ key: 'checkin', goal: 1, count: 1 }, { key: 'spin', goal: 3, count: 0 }, { key: 'restore', goal: 5, count: 0 }] } as unknown as Hunt;
const quest = (done: boolean) => ({ quest_id: String(Math.random()), done }) as Quest;

describe('back to the Keeper with located quests (HL-C3)', () => {
  it('is ready once every located quest is done, whatever the old step counts say', () => {
    expect(readyToReturn(hunt, [quest(true), quest(true)])).toBe(true);
    expect(keeperMark(hunt, [quest(true), quest(true)])).toBe('✓');
  });
  it('waits while one is left or before they load', () => {
    expect(readyToReturn(hunt, [quest(true), quest(false)])).toBe(false);
    expect(readyToReturn(hunt, [])).toBe(false);
    expect(keeperMark(hunt, [])).toBeNull();
  });
  it('still uses the step counts for a hunt without located quests', () => {
    expect(readyToReturn(hunt, null)).toBe(false);
    const counted = { ...hunt, quests: hunt.quests.map((s) => ({ ...s, count: s.goal })) };
    expect(readyToReturn(counted, null)).toBe(true);
  });
});
