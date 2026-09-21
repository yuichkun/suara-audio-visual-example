import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// 土台 (kit / sdk) の正は CLI の template。unit test はそこを直接テストする
const sdkDir = fileURLToPath(new URL('../cli/templates/glsl/src/sdk', import.meta.url));

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
