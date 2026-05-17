import { loadConfig } from './config';
import { initLogger } from './utils/logger';
import { createAgent } from './services/agent';

async function main() {
  const logger = initLogger(loadConfig());
  const config = loadConfig();

  logger.info('='.repeat(50));
  logger.info('Halo Automation Agent Starting');
  logger.info('='.repeat(50));

  createAgent(config);

  logger.info('Agent ready - waiting for /scrape command from Telegram');

  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { createAgent, loadConfig };