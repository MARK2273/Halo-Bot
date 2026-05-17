import dotenv from 'dotenv';
import path from 'path';
import { Config } from '../types';
import { getLogger } from '../utils/logger';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export function loadConfig(): Config {
  const logger = getLogger();

  const requiredVars = [
    'PLATFORM_URL',
    'HALO_EMAIL',
    'HALO_PASSWORD',
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    logger.warn(`Missing optional env vars: ${missing.join(', ')}`);
  }

  const config: Config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    platformUrl: process.env.PLATFORM_URL || 'http://localhost:3000',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    haloEmail: process.env.HALO_EMAIL || '',
    haloPassword: process.env.HALO_PASSWORD || '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    telegramEnabled: process.env.TELEGRAM_ENABLED === 'true',
    reportTimezone: process.env.REPORT_TIMEZONE || 'America/New_York',
    reportSaveDir: process.env.REPORT_SAVE_DIR || './reports',
    reportFormat: (process.env.REPORT_FORMAT as 'markdown' | 'html') || 'markdown',
    scheduleCron: process.env.SCHEDULE_CRON || '0 8 * * *',
    browserHeadless: process.env.BROWSER_HEADLESS !== 'false',
    browserTimeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),
    browserViewportWidth: parseInt(process.env.BROWSER_VIEWPORT_WIDTH || '1920', 10),
    browserViewportHeight: parseInt(process.env.BROWSER_VIEWPORT_HEIGHT || '1080', 10),
    browserScreenshotsDir: process.env.BROWSER_SCREENSHOTS_DIR || './screenshots',
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    logPretty: process.env.LOG_PRETTY !== 'false',
  };

  logger.info({ config: { ...config, haloPassword: '***', telegramBotToken: '***' } }, 'Configuration loaded');

  return config;
}