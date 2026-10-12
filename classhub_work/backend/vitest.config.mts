import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    // forks = 1 processo por arquivo: env vars (VAPID etc.) isoladas entre testes
    pool: 'forks',
  },
});
