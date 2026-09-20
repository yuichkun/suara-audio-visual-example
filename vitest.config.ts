import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const sdkDir = fileURLToPath(new URL('./src/sdk', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@suara\/sdk$/, replacement: `${sdkDir}/index.ts` },
      { find: /^@suara\/sdk\//, replacement: `${sdkDir}/` },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
