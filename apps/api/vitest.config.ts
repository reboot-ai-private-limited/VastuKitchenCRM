import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(dirname, 'src') } },
  test: {
    environment: 'node',
    env: {
      MONGO_URI: 'mongodb://localhost:27017/test',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-0123',
      BCRYPT_COST: '8',
    },
  },
});
