import { Page } from 'playwright';
import { Appointment, ScraperResult } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('scraper');

export class AppointmentScraper {
  private page: Page | null;

  constructor(page: Page | null) {
    this.page = page;
  }

  setPage(page: Page): void {
    this.page = page;
  }

  async scrapeTodayAppointments(): Promise<ScraperResult> {
    if (!this.page) {
      return { success: false, error: 'Page not initialized' };
    }

    logger.info('Starting to scrape appointments');

    const appointments: Appointment[] = [];
    let pageCount = 1;
    const maxPages = 10;

    try {
      do {
        logger.info({ page: pageCount }, 'Scraping page');

        const pageAppointments = await this.extractAppointmentsFromPage();
        logger.info({ count: pageAppointments.length }, 'Extracted appointments from current page');

        appointments.push(...pageAppointments);

        const hasNextPage = await this.goToNextPage();
        if (!hasNextPage) {
          break;
        }

        pageCount++;
      } while (pageCount <= maxPages);

      const filteredAppointments = this.filterMissingEmdId(appointments);

      logger.info(
        { total: appointments.length, missingEmd: filteredAppointments.length },
        'Scraping completed'
      );

      return {
        success: true,
        data: filteredAppointments,
      };
    } catch (error) {
      logger.error({ error }, 'Error during scraping');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async extractAppointmentsFromPage(): Promise<Appointment[]> {
    if (!this.page) return [];

    const appointments: Appointment[] = [];

    try {
      await this.page.waitForTimeout(2000);

      const pageContent = await this.page.content();
      const hasTable = pageContent.includes('<table');
      const hasTbody = pageContent.includes('<tbody');
      logger.info({ hasTable, hasTbody, contentLength: pageContent.length }, 'Page structure check');

      if (!hasTable) {
        const appDiv = await this.page.$('#root, [id="root"], [class*="app"], [class*="App"]');
        if (appDiv) {
          logger.info('Found root div, waiting for React to render');
          await this.page.waitForTimeout(5000);
        }
      }

      const tableSelectors = [
        'table tbody tr',
        'table tr',
        '[role="table"] tbody tr',
        '[class*="TableBody"] tr',
        '.MuiTableBody-root tr',
        'div[class*="Table"] tr:not(:first-child)',
      ];

      let rows: any[] = [];
      for (const selector of tableSelectors) {
        rows = await this.page.$$(selector);
        if (rows.length > 0) {
          logger.info({ selector, rowCount: rows.length }, 'Found table rows');
          break;
        }
      }

      if (rows.length === 0) {
        logger.warn('No table rows found');
        return appointments;
      }

      for (const row of rows) {
        try {
          const cells = await row.$$('td');

          if (cells.length < 4) {
            continue;
          }

          const appointment = await this.extractRowData(cells);
          if (appointment && appointment.patientName !== 'Unknown') {
            appointments.push(appointment);
          }
        } catch (rowError) {
          logger.warn({ error: rowError }, 'Error extracting row');
        }
      }

      logger.info({ extractedCount: appointments.length }, 'Appointments extracted from page');
    } catch (error) {
      logger.error({ error }, 'Error extracting appointments from page');
    }

    return appointments;
  }

  private async extractRowData(cells: any[]): Promise<Appointment | null> {
    try {
      const cellTexts = await Promise.all(cells.map(async (cell) => {
        const text = await cell.textContent();
        return text?.trim() || '';
      }));

      if (cellTexts.length < 4) {
        return null;
      }

      const appointmentTimeStr = cellTexts[2]?.trim() || '';
      
      if (!this.isTodayAppointment(appointmentTimeStr)) {
        return null;
      }
      
      const appointment: Appointment = {
        patientName: cellTexts[0]?.trim() || 'Unknown',
        appointmentTime: appointmentTimeStr,
        doctorName: cellTexts[1]?.trim() || 'Unknown',
        appointmentId: cellTexts[6]?.trim() || 'N/A',
        amd_appointment_id: cellTexts[5]?.trim() || null,
        status: cellTexts[7]?.trim() || 'Unknown',
      };

      const validStatuses = ['Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Rescheduled', 'NoShow'];
      if (!validStatuses.includes(appointment.status) && cellTexts.length > 5) {
        appointment.status = cellTexts[5] || 'Unknown';
      }

      return appointment;
    } catch (error) {
      logger.warn({ error }, 'Failed to extract row data');
      return null;
    }
  }

  private isTodayAppointment(appointmentTimeStr: string): boolean {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dateMatch = appointmentTimeStr.match(/(\w+)\s+(\d+),\s+(\d+)/);
    if (!dateMatch) {
      return false;
    }
    
    const monthStr = dateMatch[1];
    const dayStr = dateMatch[2];
    const yearStr = dateMatch[3];
    
    let monthNum = monthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
    if (monthNum === -1) {
      monthNum = shortMonthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
    }
    
    if (monthNum === -1) {
      return false;
    }
    
    const monthStr2 = String(monthNum + 1).padStart(2, '0');
    const dayStr2 = String(parseInt(dayStr)).padStart(2, '0');
    const appointmentDateStr = `${yearStr}-${monthStr2}-${dayStr2}`;
    
    return appointmentDateStr === todayStr;
  }

  private filterMissingEmdId(appointments: Appointment[]): Appointment[] {
    return appointments.filter((apt) => {
      const emdId = apt.amd_appointment_id;
      return (
        emdId === null ||
        emdId === undefined ||
        emdId === '' ||
        emdId === 'null' ||
        emdId === 'undefined' ||
        emdId === '-' ||
        emdId === 'N/A' ||
        emdId === 'Not Assigned'
      );
    });
  }

  private async goToNextPage(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.waitForTimeout(1500);

      logger.info('Looking for next page button');

      const allButtons = await this.page.$$('button');
      logger.info({ buttonCount: allButtons.length }, 'Found buttons on page');

      for (let i = 0; i < allButtons.length; i++) {
        const btn = allButtons[i];
        const text = await btn.textContent();
        const classAttr = await btn.getAttribute('class') || '';
        const ariaLabel = await btn.getAttribute('aria-label') || '';
        logger.info({ index: i, text: text?.trim(), classAttr, ariaLabel }, 'Button details');
      }

      const nextSelectors = [
        'button[aria-label="Next"]',
        'button[title="Next page"]',
        'button[aria-label="next page"]',
        'button:has-text("Next")',
        'button:has-text("›")',
        'button:has-text(">")',
        '[class*="pagination"] button:has-text("Next")',
        '[class*="Pagination"] button:last-child:not(:first-child)',
        '[role="pagination"] button:last-child',
        '.MuiPaginationButton-last',
        'li.MuiPaginationItem-last button',
        'button.MuiButtonBase-root:last-of-type',
        'nav[aria-label="pagination"] button:last-child',
      ];

      let nextButton = null;
      for (const selector of nextSelectors) {
        nextButton = await this.page.$(selector);
        if (nextButton) {
          logger.info({ selector }, 'Found next button');
          break;
        }
      }

      if (nextButton) {
        const isDisabled = await nextButton.isDisabled().catch(() => false);
        const ariaDisabled = await nextButton.getAttribute('aria-disabled').catch(() => null);
        const classAttr = await nextButton.getAttribute('class') || '';

        if (isDisabled || ariaDisabled === 'true' || classAttr.includes('disabled')) {
          logger.info('Next button is disabled, reached last page');
          return false;
        }

        logger.info('Clicking next page button');
        await nextButton.click();
        await this.page.waitForTimeout(3000);
        return true;
      }

      const paginationContainer = await this.page.$('[class*="pagination"], [class*="Pagination"], nav[aria-label]');
      if (paginationContainer) {
        logger.info('Found pagination container, looking for next button inside');
        const containerButtons = await paginationContainer.$$('button');
        
        for (const btn of containerButtons) {
          const text = await btn.textContent();
          const classAttr = await btn.getAttribute('class') || '';
          
          if ((text?.toLowerCase().includes('next') || text === '›') && !classAttr.includes('disabled')) {
            logger.info({ text }, 'Found next button in container');
            await btn.click();
            await this.page.waitForTimeout(3000);
            return true;
          }
        }
      }

      const isDisabled = (classAttr: string) => classAttr.includes('disabled') || classAttr.includes('opacity-50') || classAttr.includes('cursor-not-allowed');
      let currentPageNum = 1;
      
      for (const btn of allButtons) {
        const text = await btn.textContent();
        const classAttr = await btn.getAttribute('class') || '';
        
        if (classAttr.includes('bg-primary') && text && !isNaN(parseInt(text))) {
          currentPageNum = parseInt(text);
          break;
        }
      }
      
      logger.info({ currentPage: currentPageNum }, 'Current page number');
      
      if (currentPageNum >= 2) {
        logger.info('Already on page 2 or higher, checking if next arrow is enabled');
        
        for (const btn of allButtons) {
          const text = await btn.textContent();
          const classAttr = await btn.getAttribute('class') || '';
          const ariaLabel = await btn.getAttribute('aria-label') || '';
          
          const btnIsDisabled = isDisabled(classAttr);
          const isNextArrow = (text === '' || text === '›' || text === '>' || ariaLabel.toLowerCase().includes('next'));
          
          if (isNextArrow && !btnIsDisabled) {
            logger.info({ text, ariaLabel }, 'Found enabled next arrow, clicking');
            await btn.click();
            await this.page.waitForTimeout(3000);
            return true;
          }
        }
        
        logger.info('Next arrow disabled, reached last page');
        return false;
      }
      
      for (const btn of allButtons) {
        const text = await btn.textContent();
        const classAttr = await btn.getAttribute('class') || '';
        
        const isCurrentPage = classAttr.includes('bg-primary');
        const isNumericPage = text && !isNaN(parseInt(text)) && !isCurrentPage;
        
        if (isNumericPage && parseInt(text) > currentPageNum) {
          logger.info({ text, currentPage: currentPageNum }, 'Clicking next page number');
          await btn.click();
          await this.page.waitForTimeout(3000);
          return true;
        }
      }

      const pageButtons = await this.page.$$('[class*="PaginationItem"], [role="pagination"] button, .MuiPaginationItem');
      logger.info({ pageButtons: pageButtons.length }, 'Checking MUI pagination buttons');

      for (let i = 0; i < pageButtons.length; i++) {
        const btn = pageButtons[i];
        const isCurrent = await btn.evaluate(el => el.classList.contains('Mui-selected') || el.getAttribute('aria-current') === 'true');
        if (!isCurrent) {
          const text = await btn.textContent();
          logger.info({ text }, 'Clicking page button');
          await btn.click();
          await this.page.waitForTimeout(3000);
          return true;
        }
      }

      logger.info('No next page button found, may be on last page');
      return false;
    } catch (error) {
      logger.warn({ error }, 'Error navigating to next page');
      return false;
    }
  }

  async scrapeWithApiAlternative(): Promise<ScraperResult> {
    logger.info('Using API alternative for data extraction');

    if (!this.page) {
      return { success: false, error: 'Page not initialized' };
    }

    try {
      await this.page.waitForLoadState('networkidle');

      const pageContent = await this.page.content();
      logger.info({ contentLength: pageContent.length }, 'Page content retrieved');

      const jsonMatch = pageContent.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/);
      const dataMatch = pageContent.match(/data\s*=\s*({.*?});/);

      if (jsonMatch || dataMatch) {
        logger.info('Found JSON data in page');
      }

      const appointments = await this.extractTableData();

      return {
        success: true,
        data: appointments,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async extractTableData(): Promise<Appointment[]> {
    if (!this.page) return [];

    const appointments: Appointment[] = [];

    try {
      const tableSelectors = [
        'table',
        '[data-testid="appointment-table"]',
        '.MuiTable-root',
        '[class*="Table"]',
      ];

      let table: any = null;
      for (const selector of tableSelectors) {
        table = await this.page.$(selector);
        if (table) break;
      }

      if (!table) {
        logger.warn('No table found on page');
        return appointments;
      }

      const rows = await table.$$('tbody tr, tr');
      logger.info({ rowCount: rows.length }, 'Table rows found');

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = await row.$$('td');

        if (cells.length < 4) continue;

        const cellData = await Promise.all(cells.map((c: any) => c.textContent()));
        const trimmedData = cellData.map(t => t?.trim() || '');

        const apt: Appointment = {
          patientName: trimmedData[0] || 'Unknown',
          appointmentTime: trimmedData[1] || 'Unknown',
          doctorName: trimmedData[2] || 'Unknown',
          appointmentId: trimmedData[3] || 'N/A',
          amd_appointment_id: trimmedData[4] || null,
          status: trimmedData[5] || 'Unknown',
        };

        if (this.isValidAppointment(apt)) {
          appointments.push(apt);
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error extracting table data');
    }

    return appointments;
  }

  private isValidAppointment(apt: Appointment): boolean {
    return (
      apt.patientName !== 'Unknown' &&
      apt.patientName !== '' &&
      apt.appointmentTime !== 'Unknown' &&
      apt.appointmentTime !== ''
    );
  }
}

export function createScraper(page: Page | null): AppointmentScraper {
  return new AppointmentScraper(page);
}