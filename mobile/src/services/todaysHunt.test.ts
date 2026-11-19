import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ supabase: {} }));
import { MISS_POINTS, RIGHT_POINTS, todaysHunt, TODAYS_HUNT_BACKEND } from './todaysHunt';

describe("Today's Hunt sample follows HL-C4", () => {
  it.skipIf(TODAYS_HUNT_BACKEND)('gives 3 blue quests: question, price, catch, with no answers', async () => {
    const day = await todaysHunt.today('taipei');
    expect(day.quests.map((q) => q.type)).toEqual(['question', 'price', 'catch']);
    expect(JSON.stringify(day)).not.toContain('"usd"');
  });
  it.skipIf(TODAYS_HUNT_BACKEND)('scores 10 for right and 2 otherwise, finishes once and keeps the streak', async () => {
    const before = (await todaysHunt.today('macau')).streak;
    expect(await todaysHunt.attempt('macau', 1, { choice: 0 })).toMatchObject({ ok: false, done: true, points: MISS_POINTS, correct_answer: { choice: 1 } });
    await expect(todaysHunt.attempt('macau', 1, { choice: 1 })).rejects.toMatchObject({ code: 'already_done' });
    expect(await todaysHunt.attempt('macau', 2, { usd: 0.5 })).toMatchObject({ ok: false, done: false, hint: 'higher', tries_left: 2 });
    expect(await todaysHunt.attempt('macau', 2, { usd: 1.4 })).toMatchObject({ ok: true, done: true, points: RIGHT_POINTS });
    expect(await todaysHunt.attempt('macau', 3, { caught: 5 })).toMatchObject({ ok: true, points: RIGHT_POINTS });
    const day = await todaysHunt.today('macau');
    expect(day).toMatchObject({ finished: true, score: MISS_POINTS + 2 * RIGHT_POINTS, streak: before + 1 });
  });
  it.skipIf(TODAYS_HUNT_BACKEND)('ends the price after 3 misses with 2 points and the answer', async () => {
    await todaysHunt.attempt('singapore', 2, { usd: 1 });
    await todaysHunt.attempt('singapore', 2, { usd: 1 });
    expect(await todaysHunt.attempt('singapore', 2, { usd: 1 })).toMatchObject({ ok: false, done: true, points: MISS_POINTS, tries_left: 0, correct_answer: { local_amount: 9 } });
  });
});
