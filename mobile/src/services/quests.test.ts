import { describe, expect, it } from 'vitest';
import { guessHint } from './quests';

describe('price guess arrows', () => {
  it('uses the server hint while guesses remain', () => {
    expect(guessHint({ ok: false, done: false, points: 0, hint: 'lower', tries_left: 2 }, 10)).toBe('lower');
  });
  it('works out the last miss from the answer it comes back with', () => {
    const last = { ok: false, done: true, points: 0, correct_answer: { usd: 3.04, local_amount: 97 } };
    expect(guessHint(last, 1000)).toBe('lower');
    expect(guessHint(last, 1)).toBe('higher');
  });
  it('marks a right guess solved', () => {
    expect(guessHint({ ok: true, done: true, points: 30 }, 3)).toBe('solved');
  });
});
