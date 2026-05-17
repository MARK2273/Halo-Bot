import pino from 'pino';
import { Config } from '../types';

let logger: pino.Logger;

function createDefaultLogger(): pino.Logger {
  return pino({
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  });
}

export function initLogger(config: Config): pino.Logger {
  logger = pino({
    level: config.logLevel,
    transport: config.logPretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });

  return logger;
}

export function getLogger(): pino.Logger {
  if (!logger) {
    logger = createDefaultLogger();
  }
  return logger;
}

export function createChildLogger(name: string): pino.Logger {
  return getLogger().child({ component: name });
}