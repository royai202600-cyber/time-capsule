import { describe, expect, it, vi } from 'vitest';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(async () => null), setItem: vi.fn() } }));
vi.mock('./supabase', () => ({ supabase: {} }));
import { CITIES } from './cityPuzzle';
import { answerMatches, arriveStop, cityAt, landmarkNear, routes, stopForSend, stopFromPool, stopProblems, type PoolItem, ROUTES_BACKEND } from './routes';

const taipei = CITIES.find((c) => c.id === 'taipei')!;
const pool: PoolItem = { pool_id: 'p1', type: 'price', location_lat: taipei.lat, location_lng: taipei.lng, name_zh: '店', name_en: 'Shop' };

describe('route stops (HL-C5)', () => {
  it('matches a typed answer ignoring case and spaces, never an empty one', () => {
    expect(answerMatches(' Lin  Family ', 'lin family')).toBe(true);
    expect(answerMatches('林家　花園', '林家花園')).toBe(true);
    expect(answerMatches('', '')).toBe(false);
    expect(answerMatches('no', 'yes')).toBe(false);
  });
  it('finds the city and the Landmark within 2 km', () => {
    expect(cityAt(taipei.lat + 0.01, taipei.lng).id).toBe('taipei');
    expect(landmarkNear(taipei.lat + 0.01, taipei.lng)?.id).toBe('taipei');
    expect(landmarkNear(taipei.lat + 0.05, taipei.lng)).toBeNull();
  });
  it('lists what a stop still needs', () => {
    const here = arriveStop(taipei.lat, taipei.lng, 'Gate');
    expect(stopProblems(here)).toEqual([]);
    expect(stopProblems({ ...here, name_zh: ' ', name_en: '' })).toEqual(['name']);
    expect(stopProblems({ ...here, type: 'question' })).toEqual(['question']);
    expect(stopProblems({ ...here, type: 'question', own_question: 'Colour of the door?', own_answer: 'red' })).toEqual([]);
    expect(stopProblems({ ...here, type: 'price' })).toEqual(['price']);
    expect(stopProblems({ ...here, type: 'landmark', location_lat: taipei.lat + 0.05 })).toEqual(['landmark']);
  });
  it('sends a pool id, an own question, or a catch count, and trims the name to 60', () => {
    const fromPool = stopForSend(stopFromPool(pool), false);
    expect(fromPool).toMatchObject({ type: 'price', pool_id: 'p1', name: 'Shop' });
    expect(fromPool).not.toHaveProperty('own_answer');
    const own = stopForSend({ ...arriveStop(1, 2, 'x'.repeat(80)), type: 'question', own_question: ' Q? ', own_answer: ' A ' }, true);
    expect(own).toMatchObject({ own_question: 'Q?', own_answer: 'A' });
    expect(own.name).toHaveLength(60);
    expect(stopForSend({ ...arriveStop(1, 2, 'c'), type: 'catch' }, true)).toMatchObject({ catch_count: 3 });
    expect(stopForSend(arriveStop(1, 2, 'a'), true)).toEqual({ type: 'arrive', location_lat: 1, location_lng: 2, name: 'a' });
  });
  it.skipIf(ROUTES_BACKEND)('sample templates use city pool items with no answers', async () => {
    const t = await routes.templates('taipei');
    expect(t.length).toBeGreaterThan(0);
    expect(JSON.stringify(t)).not.toMatch(/"(usd|answer)"/);
  });
});
