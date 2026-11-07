/// <reference types="node" />
import { createRequire } from 'node:module';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// These are bundled asset IDs in Expo; unit tests only need their identities.
const require = createRequire(import.meta.url);
const previousWavLoader = require.extensions['.wav'];
require.extensions['.wav'] = (module, filename) => { module.exports = filename; };
afterAll(() => { if (previousWavLoader) require.extensions['.wav'] = previousWavLoader; else delete require.extensions['.wav']; });
const audio = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('expo-audio', () => ({ createAudioPlayer: audio.create }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn().mockResolvedValue(null), setItem: vi.fn().mockResolvedValue(undefined) } }));
const effects: Array<{ isLoaded: boolean; playing: boolean; volume: number; play: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; finish: () => void }> = [];
beforeEach(() => {
  vi.resetModules(); effects.length = 0; audio.create.mockReset();
  audio.create.mockImplementation(() => {
    const player = { isLoaded: true, playing: false, volume: 0, play: vi.fn(), seekTo: vi.fn().mockResolvedValue(undefined), remove: vi.fn(), finish: () => {}, addListener: vi.fn((_event, listener) => { player.finish = () => listener({ didJustFinish: true }); return { remove: vi.fn() }; }) };
    effects.push(player); return player;
  });
});

describe('sound feedback latency', () => {
  it('prepares all players before an interaction and plays without seeking first', async () => {
    const sfx = await import('./sfx'); sfx.prepareSoundEffects();
    expect(audio.create).toHaveBeenCalledTimes(9);
    sfx.playSound('tick');
    expect(effects[0].play).toHaveBeenCalledOnce();
    expect(effects[0].seekTo).not.toHaveBeenCalled();
    sfx.releaseSoundEffects();
    expect(effects.every(player => player.remove.mock.calls.length === 1)).toBe(true);
  });
  it('skips unloaded feedback instead of queuing a delayed sound', async () => {
    const sfx = await import('./sfx'); sfx.prepareSoundEffects(); effects[0].isLoaded = false;
    sfx.playSound('tick'); effects[0].isLoaded = true;
    expect(effects[0].play).not.toHaveBeenCalled();
    sfx.playSound('tick'); expect(effects[0].play).toHaveBeenCalledOnce();
  });
  it('does not queue repeated triggers and rewinds between interactions', async () => {
    const sfx = await import('./sfx'); sfx.prepareSoundEffects();
    sfx.playSound('tick'); sfx.playSound('tick');
    expect(effects[0].play).toHaveBeenCalledOnce();
    effects[0].finish(); await Promise.resolve();
    expect(effects[0].seekTo).toHaveBeenCalledWith(0);
    sfx.playSound('tick'); expect(effects[0].play).toHaveBeenCalledTimes(2);
  });
  it('respects the separate sound-effects switch', async () => {
    const sfx = await import('./sfx'); sfx.prepareSoundEffects(); sfx.setSoundEffects(false); sfx.playSound('tick');
    expect(effects[0].play).not.toHaveBeenCalled();
  });
});
