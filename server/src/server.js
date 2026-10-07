import dotenv from 'dotenv';
dotenv.config();

import pino from 'pino';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    const { seedRulesConfig } = await import('./services/configSeedService.js');
    await seedRulesConfig();
    const app = createApp();

    app.listen(PORT, () => {
      logger.info(`TCE Syllabus Validator API Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Allowed Domain: @${process.env.ALLOWED_DOMAIN || 'tce.edu'}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
