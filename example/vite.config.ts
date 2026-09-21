import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const sdkDir = fileURLToPath(new URL('./src/sdk', import.meta.url));

// dev server の port は suara.json の devUrl が SSoT (DAW 内の plugin もここを見に来る)
const manifest = JSON.parse(readFileSync(new URL('./suara.json', import.meta.url), 'utf8')) as {
  devUrl: string;
};
const devPort = Number(new URL(manifest.devUrl).port);

// AudioWorklet は一度 addModule したら差し替えられないので、worklet の変更は full reload にする
function workletFullReload(): Plugin {
  return {
    name: 'suara-worklet-full-reload',
    handleHotUpdate(ctx) {
      if (ctx.file.includes('/worklets/')) {
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
      return undefined;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [workletFullReload()],
  worker: { format: 'es' },
  resolve: {
    alias: [
      { find: /^@suara\/sdk$/, replacement: `${sdkDir}/index.ts` },
      { find: /^@suara\/sdk\//, replacement: `${sdkDir}/` },
    ],
  },
  server: {
    port: devPort,
    // SharedArrayBuffer (SDK の MIDI ring) に crossOriginIsolated が要る
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
