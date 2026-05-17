import cron from 'node-cron';
import { Config } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('scheduler');

export type JobCallback = () => Promise<void>;

export class Scheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(_config: Config) {
  }

  schedule(name: string, cronExpression: string, callback: JobCallback): void {
    if (!cron.validate(cronExpression)) {
      logger.error({ cronExpression }, 'Invalid cron expression');
      return;
    }

    logger.info({ name, cron: cronExpression }, 'Scheduling job');

    const task = cron.schedule(cronExpression, async () => {
      logger.info({ name }, 'Executing scheduled job');

      try {
        await callback();
        logger.info({ name }, 'Job completed successfully');
      } catch (error) {
        logger.error({ error, name }, 'Job execution failed');
      }
    });

    this.jobs.set(name, task);
    logger.info({ name, cron: cronExpression }, 'Job scheduled');
  }

  scheduleDaily(callback: JobCallback, hour: number = 8, minute: number = 0): void {
    const cronExpression = `${minute} ${hour} * * *`;
    this.schedule('daily-report', cronExpression, callback);
  }

  scheduleWeekly(callback: JobCallback, dayOfWeek: number = 1, hour: number = 8, minute: number = 0): void {
    const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
    this.schedule('weekly-report', cronExpression, callback);
  }

  stop(name: string): void {
    const task = this.jobs.get(name);
    if (task) {
      task.stop();
      this.jobs.delete(name);
      logger.info({ name }, 'Job stopped');
    }
  }

  stopAll(): void {
    logger.info('Stopping all scheduled jobs');
    for (const [name, task] of this.jobs) {
      task.stop();
      logger.info({ name }, 'Job stopped');
    }
    this.jobs.clear();
  }

  getScheduledJobs(): string[] {
    return Array.from(this.jobs.keys());
  }
}

export function createScheduler(config: Config): Scheduler {
  return new Scheduler(config);
}