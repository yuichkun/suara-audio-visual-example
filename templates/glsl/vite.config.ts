import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const sdkDir = fileURLToPath(new URL('./src/sdk', import.meta.url));

const manifest = JSON.parse(
  readFileSync(new URL('./suara.json', import.meta.url), 'utf8'),
);
const devPort = Number(new URL(manifest.devUrl).port);

function workletFullReload() {
  return {
    name: 'suara-worklet-full-reload',
    handleHotUpdate(ctx: { file: string; server: { ws: { send: (m: object) => void } } }) {
      if (ctx.file.includes('/worklets/')) {
        ctx.server.ws.send({ type: 'full-reload' });
        return [];
      }
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
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        ...(existsSync(fileURLToPath(new URL('./harness.html', import.meta.url)))
          ? { harness: fileURLToPath(new URL('./harness.html', import.meta.url)) }
          : {}),
      },
    },
  },
  server: {
    port: devPort,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
