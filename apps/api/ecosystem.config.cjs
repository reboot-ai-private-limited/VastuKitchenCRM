/**
 * PM2 process file. Deploy: pnpm install --frozen-lockfile && pnpm --filter @vastu/api build
 * && pm2 reload apps/api/ecosystem.config.cjs --env production
 *
 * ONE instance only: reminder cron runs inside the API process (see docs/03-architecture/deployment.md).
 * Env comes from apps/api/.env (loaded by dotenv), never committed.
 */
module.exports = {
  apps: [
    {
      name: 'vastu-api',
      cwd: __dirname,
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      kill_timeout: 20000, // > server.ts SHUTDOWN_TIMEOUT_MS so in-flight requests drain
      env_production: { NODE_ENV: 'production' },
    },
  ],
};
