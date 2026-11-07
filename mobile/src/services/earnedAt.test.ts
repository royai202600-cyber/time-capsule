import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), single: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from: mocks.from } }));
import { vessels } from './data';
beforeEach(() => {
  mocks.single.mockReset(); mocks.from.mockReset();
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: mocks.single };
  mocks.from.mockReturnValue(query);
});
describe('landmark celebration ownership lookup', () => {
  it('distinguishes newly unowned from already owned', async () => {
    mocks.single.mockResolvedValueOnce({ data: { id: 'bamboo-tower' }, error: null }).mockResolvedValueOnce({ data: null, error: null });
    expect(await vessels.earnedAt('taipei101', 'recipient')).toEqual({ id: 'bamboo-tower', owned: false });
    mocks.single.mockResolvedValueOnce({ data: { id: 'bamboo-tower' }, error: null }).mockResolvedValueOnce({ data: { vessel: 'bamboo-tower' }, error: null });
    expect(await vessels.earnedAt('taipei101', 'recipient')).toEqual({ id: 'bamboo-tower', owned: true });
  });
  it('does not turn an ownership network error into a first-time reward', async () => {
    const error = new Error('ownership unavailable');
    mocks.single.mockResolvedValueOnce({ data: { id: 'bamboo-tower' }, error: null }).mockResolvedValueOnce({ data: null, error });
    await expect(vessels.earnedAt('taipei101', 'recipient')).rejects.toBe(error);
  });
  it('propagates catalogue errors and skips places with no reward', async () => {
    const error = new Error('catalogue unavailable');
    mocks.single.mockResolvedValueOnce({ data: null, error });
    await expect(vessels.earnedAt('taipei101', 'recipient')).rejects.toBe(error);
    mocks.single.mockResolvedValueOnce({ data: null, error: null });
    expect(await vessels.earnedAt('aurele-cotai', 'recipient')).toBeNull();
  });
});
