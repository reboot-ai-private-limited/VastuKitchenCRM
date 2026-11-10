import mongoose from 'mongoose';
import { env, isProduction } from '@/config/env.js';
import { logger } from '@/shared/logging/logger.js';
import { SWAGGER_DOCS_PATH } from '@/shared/http/swagger.util.js';
import { startIntervalJob, type IntervalJob } from '@/shared/jobs/intervalJob.js';
import { createApp } from './app.js';

const SHUTDOWN_TIMEOUT_MS = 15_000;

async function start() {
  try {
    await mongoose.connect(env.MONGO_URI);
  } catch (cause) {
    logger.fatal({ err: String(cause) }, 'failed to connect to MongoDB');
    process.exit(1);
  }
  logger.info('connected to MongoDB');

  const jobs: IntervalJob[] = [];
  const app = createApp({
    onContainers: ({ reminders }) => {
      // Scheduled jobs run on ONE instance only (ENABLE_CRON); see docs/03-architecture/deployment.md.
      if (env.ENABLE_CRON) {
        jobs.push(
          startIntervalJob('reminders', env.REMINDER_INTERVAL_MINUTES * 60_000, () =>
            reminders.contract.run(),
          ),
        );
      } else {
        logger.info('scheduled jobs are off (ENABLE_CRON=false)');
      }
    },
  });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Vastu API listening');
    if (!isProduction) {
      logger.info(
        { url: `http://localhost:${env.PORT}${SWAGGER_DOCS_PATH}` },
        'Swagger docs available',
      );
    }
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'signal received, draining');
    const force = setTimeout(() => {
      logger.fatal('drain timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    for (const job of jobs) job.stop();

    server.close(() => {
      mongoose
        .disconnect()
        .catch((cause: unknown) =>
          logger.error({ err: String(cause) }, 'error disconnecting MongoDB'),
        )
        .finally(() => {
          logger.info('shutdown complete');
          process.exit(0);
        });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void start();
