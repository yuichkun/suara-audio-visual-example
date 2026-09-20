// Host API polyfills for Node — not SDK mocks.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const id = setImmediate(() => cb(performance.now())) as unknown as number;
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearImmediate(id as unknown as NodeJS.Immediate);
  };
}

Object.defineProperty(globalThis, 'crossOriginIsolated', {
  value: true,
  configurable: true,
});

// midi.ts checks `self.crossOriginIsolated` (browser global alias of globalThis)
if (typeof (globalThis as { self?: typeof globalThis }).self === 'undefined') {
  (globalThis as { self: typeof globalThis }).self = globalThis;
}
