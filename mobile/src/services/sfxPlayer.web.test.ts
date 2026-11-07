/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('expo-asset', () => ({ Asset: { fromModule: (id: number) => ({ uri: `/effect-${id}.wav` }) } }));
let gestureHandlers: Record<string, () => void>;
let allowed: boolean;
let ctx: {
  state: string; resume: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>;
  decodeAudioData: ReturnType<typeof vi.fn>; createGain: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>; destination: object;
};
let nodes: Array<{ buffer: unknown; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: null | (() => void) }>;
beforeEach(() => {
  vi.resetModules(); gestureHandlers = {}; nodes = []; allowed = false;
  ctx = {
    state: 'suspended', destination: {},
    resume: vi.fn(async () => { if (!allowed) throw new Error('NotAllowedError'); ctx.state = 'running'; }),
    close: vi.fn(async () => { ctx.state = 'closed'; }),
    decodeAudioData: vi.fn(async () => ({ decoded: true })),
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
    createBufferSource: vi.fn(() => {
      const node = { buffer: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
      nodes.push(node); return node;
    }),
  };
  vi.stubGlobal('AudioContext', class { constructor() { return ctx; } });
  vi.stubGlobal('window', {
    addEventListener: vi.fn((event, handler) => { gestureHandlers[event] = handler; }),
    removeEventListener: vi.fn((event) => { delete gestureHandlers[event]; }),
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })));
});
afterEach(() => { vi.unstubAllGlobals(); });
const loaded = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('browser sound effects', () => {
  it('unlocks one context for all effects and plays repeated swipes from decoded buffers', async () => {
    const { createEffectPlayer } = await import('./sfxPlayer.web');
    const tap = createEffectPlayer(1), page = createEffectPlayer(2);
    await loaded(); expect(page.isLoaded).toBe(true);
    expect(page.play()).toBe(false); // blocked play must not wedge the effect
    await loaded();
    allowed = true; gestureHandlers.touchend(); await loaded();
    expect(page.play()).toBe(true); expect(page.play()).toBe(false);
    nodes[0].onended?.();
    expect(page.play()).toBe(true); expect(tap.play()).toBe(true);
    expect(nodes).toHaveLength(3);
    expect(nodes.every(node => node.start.mock.calls.length === 1)).toBe(true);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(2); // no decoding on interaction
    page.remove(); expect(ctx.close).not.toHaveBeenCalled();
    tap.remove(); expect(ctx.close).toHaveBeenCalledOnce();
    expect(gestureHandlers).toEqual({});
  });
  it('finishes reliably without relying on HTML media status timing', async () => {
    const { createEffectPlayer } = await import('./sfxPlayer.web');
    const player = createEffectPlayer(1); await loaded();
    const listener = vi.fn(); player.addListener('playbackStatusUpdate', listener);
    allowed = true; gestureHandlers.pointerdown(); await loaded();
    player.play(); nodes[0].onended?.();
    expect(player.playing).toBe(false);
    expect(listener).toHaveBeenCalledWith({ didJustFinish: true });
    player.remove();
  });
  it('skips unloaded feedback and does not play it after downloading', async () => {
    const { createEffectPlayer } = await import('./sfxPlayer.web');
    const player = createEffectPlayer(1);
    expect(player.play()).toBe(false); await loaded();
    expect(nodes).toHaveLength(0); player.remove();
  });
});
