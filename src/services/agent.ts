import { Config, ScraperResult } from '../types';
import { BrowserService, createBrowserService } from './browser';
import { AppointmentScraper, createScraper } from './scraper';
import { ReportGenerator, createReportGenerator } from './report';
import { TelegramService, createTelegramService } from './telegram';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('agent');

export class AutomationAgent {
  private config: Config;
  private browser: BrowserService;
  private scraper: AppointmentScraper;
  private reportGenerator: ReportGenerator;
  private telegram: TelegramService;
  private isRunning: boolean = false;

  constructor(config: Config) {
    this.config = config;
    this.browser = createBrowserService(config);
    this.scraper = createScraper(null);
    this.reportGenerator = createReportGenerator(config);
    this.telegram = createTelegramService(config);
    
    this.telegram.setCommandHandler(async () => {
      await this.runWithRetry(this.config.maxRetries);
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing automation agent');
    await this.browser.initialize();
    logger.info('Agent initialized');
  }

  async runReport(): Promise<boolean> {
    if (this.isRunning) {
      logger.warn('Agent already running, skipping');
      return false;
    }

    this.isRunning = true;

    try {
      logger.info('Starting report generation');

      const loginSuccess = await this.browser.login(
        this.config.haloEmail,
        this.config.haloPassword
      );

      if (!loginSuccess) {
        logger.error('Login failed');
        await this.browser.captureScreenshot('login-failure');
        await this.sendFailureAlert('Login Failed', 'Failed to log into the platform');
        return false;
      }

      const navSuccess = await this.browser.navigateToAppointments();
      if (!navSuccess) {
        logger.error('Navigation to appointments failed');
        await this.browser.captureScreenshot('navigation-failure');
        await this.sendFailureAlert('Navigation Failed', 'Failed to navigate to appointments page');
        return false;
      }

      await this.browser.applyTodayFilter();
      await this.browser.applyAmdIdFilter();
      await this.browser.waitForTableLoad();

      const page = await this.browser.getPage();
      if (page) {
        this.scraper.setPage(page);
      }

      const scrapeResult: ScraperResult = await this.scraper.scrapeTodayAppointments();

      if (!scrapeResult.success) {
        logger.error({ error: scrapeResult.error }, 'Scraping failed');
        await this.browser.captureScreenshot('scraping-failure');
        await this.sendFailureAlert(
          'Scraping Failed',
          scrapeResult.error || 'Unknown error during scraping'
        );
        return false;
      }

      const appointments = scrapeResult.data || [];
      logger.info({ count: appointments.length }, 'Appointments scraped');

      const reportData = this.reportGenerator.generateReport(appointments);

      await this.reportGenerator.saveMarkdownReport(reportData);
      logger.info('Markdown report saved');

      if (this.config.reportFormat === 'html') {
        await this.reportGenerator.saveHtmlReport(reportData);
        logger.info('HTML report saved');
      }

      const telegramMessage = this.reportGenerator.getReportForTelegram(reportData);
      const telegramResult = await this.telegram.sendReport(reportData, telegramMessage);

      if (telegramResult.success) {
        logger.info('Report sent to Telegram');
      } else {
        logger.warn({ error: telegramResult.error }, 'Failed to send to Telegram');
      }

      logger.info('Report generation completed successfully');

      return true;
    } catch (error) {
      logger.error({ error }, 'Error during report generation');
      await this.browser.captureScreenshot('error');
      await this.sendFailureAlert(
        'Agent Error',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return false;
    } finally {
      this.isRunning = false;
      await this.browser.close();
    }
  }

  async runWithRetry(maxRetries: number = 3): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info({ attempt, maxRetries }, 'Running report attempt');

      try {
        await this.initialize();
        const success = await this.runReport();

        if (success) {
          return true;
        }

        if (attempt < maxRetries) {
          logger.info(`Retrying in ${this.config.retryDelayMs}ms`);
          await this.delay(this.config.retryDelayMs);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.error({ error: lastError, attempt }, 'Error on attempt');
      } finally {
        await this.browser.close();
      }
    }

    logger.error({ lastError }, 'All retry attempts failed');
    return false;
  }

  isAgentRunning(): boolean {
    return this.isRunning;
  }

  private async sendFailureAlert(title: string, message: string): Promise<void> {
    if (this.telegram.isEnabled()) {
      await this.telegram.sendAlert(title, message);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createAgent(config: Config): AutomationAgent {
  return new AutomationAgent(config);
}