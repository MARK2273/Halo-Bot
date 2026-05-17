import { chromium, Browser, Page, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import { Config } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('browser');

export class BrowserService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info('Initializing browser...');

    const userDataDir = path.join(process.cwd(), '.browser-data');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    this.browser = await chromium.launch({
      headless: this.config.browserHeadless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    this.context = await this.browser.newContext({
      viewport: {
        width: this.config.browserViewportWidth,
        height: this.config.browserViewportHeight,
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();

    this.page.setDefaultTimeout(this.config.browserTimeout);

    logger.info('Browser initialized successfully');
  }

  async login(email: string, password: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    logger.info({ email }, 'Navigating to login page');

    await this.page.goto(`${this.config.frontendUrl}/login`, {
      waitUntil: 'domcontentloaded',
    });

    await this.page.waitForTimeout(3000);

    logger.info('Filling login credentials');

    await this.page.waitForSelector('input[name="email"]', { timeout: 10000 }).catch(() => null);
    await this.page.waitForSelector('input[name="password"]', { timeout: 10000 }).catch(() => null);

    const emailInput = await this.page.$('input[name="email"]');
    const passwordInput = await this.page.$('input[name="password"]');
    const submitButton = await this.page.$('button[type="submit"]');

    if (!emailInput || !passwordInput || !submitButton) {
      logger.error('Login form elements not found');
      logger.info('Page content:', await this.page.content().then(c => c.substring(0, 500)));
      return false;
    }

    await emailInput.fill(email);
    await this.page.waitForTimeout(500);
    await passwordInput.fill(password);
    await this.page.waitForTimeout(500);
    await submitButton.click();

    await this.captureScreenshot('after-submit');

    logger.info('Waiting for login to complete...');

    await this.page.waitForTimeout(5000);

    const currentUrl = this.page.url();
    logger.info({ currentUrl }, 'URL after login submit');

    if (currentUrl.includes('/login')) {
      await this.handleRoleSelection();
      await this.page.waitForTimeout(2000);
    }

    try {
      await this.page.waitForURL(`${this.config.frontendUrl}/**/dashboard`, {
        timeout: 30000,
      });
      logger.info('Login successful');
      return true;
    } catch (error) {
      const pageUrl = this.page?.url();
      if (pageUrl?.includes('dashboard')) {
        logger.info('Login successful - already on dashboard');
        return true;
      }
      logger.error({ error }, 'Login failed - not redirected to dashboard');
      await this.captureScreenshot('login-result');
      logger.info({ pageUrl }, 'Current page state');
      return false;
    }
  }

  async navigateToAppointments(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    logger.info('Navigating to appointments page');

    const adminAppointmentsUrl = `${this.config.frontendUrl}/appointment`;
    await this.page.goto(adminAppointmentsUrl, {
      waitUntil: 'networkidle',
    });

    await this.page.waitForLoadState('domcontentloaded');

    await this.page.waitForTimeout(2000);

    const currentUrl = this.page.url();
    logger.info({ currentUrl }, 'Current URL after navigation');

    return currentUrl.includes('appointment');
  }

  async applyAmdIdFilter(): Promise<boolean> {
    logger.info('AMD ID filter - using code-based filtering');
    return false;
  }

async applyTodayFilter(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    logger.info('Applying today date filter via UI interaction');

    try {
      const today = new Date();
      const todayDay = today.getDate();

      await this.page.waitForTimeout(2000);

      logger.info('Looking for Filter By button');
      const filterButton = await this.page.$('button:has-text("Filter By")');
      
      if (!filterButton) {
        logger.warn('Filter By button not found');
        return false;
      }
      
      await filterButton.click();
      await this.page.waitForTimeout(1500);
      await this.captureScreenshot('filter-dropdown-v2');

      logger.info('Looking for date range picker');
      const dateRangeInput = await this.page.$('input[placeholder*="Date Range"], input[placeholder*="Select Date"]');
      
      if (!dateRangeInput) {
        logger.warn('Date range input not found');
        return false;
      }
      
      logger.info('Opening date picker');
      await dateRangeInput.click();
      await this.page.waitForTimeout(1500);
      await this.captureScreenshot('date-picker-v2');

      const dayButtons = await this.page.$$('[role="gridcell"]:not([aria-disabled="true"])');
      
      let startButton = null;
      
      for (const dayBtn of dayButtons) {
        const dayText = await dayBtn.textContent();
        const ariaLabel = await dayBtn.getAttribute('aria-label') || '';
        const classAttr = await dayBtn.getAttribute('class') || '';
        
        if (classAttr.includes(`react-datepicker__day--0${todayDay}`) || ariaLabel.includes(`${todayDay} May`)) {
          logger.info({ dayText, ariaLabel }, 'Selecting date');
          startButton = dayBtn;
          await dayBtn.click();
          await this.page.waitForTimeout(500);
          await this.captureScreenshot('first-date-selected');
          break;
        }
      }
      
      if (startButton) {
        try {
          logger.info('Clicking same date again for range');
          await startButton.click();
          await this.page.waitForTimeout(500);
          await this.captureScreenshot('dates-selected-v2');
        } catch (clickError) {
          logger.warn({ clickError }, 'Second click failed, trying with fresh element');
          const dayButtonsNew = await this.page.$$('[role="gridcell"]');
          for (const dayBtn of dayButtonsNew) {
            const classAttr = await dayBtn.getAttribute('class') || '';
            if (classAttr.includes(`react-datepicker__day--0${todayDay}`)) {
              await dayBtn.click();
              await this.page.waitForTimeout(500);
              break;
            }
          }
        }
      }
      
      const applyButton = await this.page.$('button:has-text("Apply")');
      if (applyButton) {
        logger.info('Clicking Apply button');
        await applyButton.click();
        await this.page.waitForTimeout(4000);
        await this.captureScreenshot('filter-result-v2');
        
        const tableRows = await this.page.$$('table tbody tr');
        logger.info({ rowCount: tableRows.length }, 'Filtered appointments count');
        
        if (tableRows.length < 10) {
          logger.info('UI filter working correctly!');
          return true;
        }
      }

      logger.warn('UI filter did not reduce row count, falling back to code filter');
      return false;
    } catch (error) {
      logger.warn({ error }, 'Error applying date filter via UI');
      return false;
    }
  }

  async waitForTableLoad(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    logger.info('Waiting for appointments data to load');

    await this.page.waitForTimeout(8000);

    await this.captureScreenshot('appointments-page');

    try {
      const tableSelectors = [
        'table tbody tr',
        '[role="table"] tbody tr',
        '.MuiTable-root tbody tr',
        '[class*="Table"] tbody tr',
        'div[class*="row"]:not([class*="header"])',
      ];

      for (const selector of tableSelectors) {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          logger.info({ selector, count: elements.length }, 'Found table rows');
          return true;
        }
      }

      const anyTable = await this.page.$('table');
      if (anyTable) {
        logger.info('Found table element');
        return true;
      }

      logger.warn('No table found, checking for loading state');
      const loading = await this.page.$('[class*="loading"], [class*="spinner"], [class*="Skeleton"]');
      if (loading) {
        await this.page.waitForTimeout(5000);
      }

      return true;
    } catch (error) {
      logger.warn({ error }, 'Error waiting for table');
      return true;
    }
  }

  async handleRoleSelection(): Promise<void> {
    if (!this.page) return;

    logger.info('Checking for role selection modal');

    try {
      await this.page.waitForSelector('[class*="modal"], [role="dialog"], .fixed, .inset-0', {
        timeout: 5000,
      });

      await this.page.waitForTimeout(1000);

      const superAdminButton = await this.page.$('button:has-text("Super Admin"), button:has-text("superadmin"), [data-value="superadmin"], div[role="button"]:has-text("Super Admin")');

      if (superAdminButton) {
        logger.info('Selecting Super Admin role');
        await superAdminButton.click();
        await this.page.waitForTimeout(1000);
        return;
      }

      const roleButtons = await this.page.$$('button');
      for (const button of roleButtons) {
        const text = await button.textContent();
        if (text && (text.toLowerCase().includes('super admin') || text.toLowerCase().includes('admin'))) {
          logger.info({ text }, 'Clicking admin role button');
          await button.click();
          await this.page.waitForTimeout(1000);
          return;
        }
      }

      logger.warn('No role selection found or already on dashboard');
    } catch (error) {
      logger.info('No role selection modal found, proceeding');
    }
  }

  async getPage(): Promise<Page | null> {
    return this.page;
  }

  async captureScreenshot(name: string): Promise<string | null> {
    if (!this.page) {
      return null;
    }

    const screenshotsDir = this.config.browserScreenshotsDir;
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(screenshotsDir, filename);

    try {
      await this.page.screenshot({ path: filepath, fullPage: true });
      logger.info({ filepath }, 'Screenshot captured');
      return filepath;
    } catch (error) {
      logger.error({ error }, 'Failed to capture screenshot');
      return null;
    }
  }

  async close(): Promise<void> {
    logger.info('Closing browser');

    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    logger.info('Browser closed');
  }
}

export function createBrowserService(config: Config): BrowserService {
  return new BrowserService(config);
}