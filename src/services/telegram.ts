import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import { Config, ReportData, TelegramResult } from '../types';
import { createChildLogger } from '../utils/logger';

const logger = createChildLogger('telegram');

export type CommandHandler = () => Promise<void>;

export class TelegramService {
  private bot: TelegramBot | null = null;
  private chatId: string;
  private enabled: boolean;
  private commandHandler: CommandHandler | null = null;

  constructor(config: Config) {
    this.enabled = config.telegramEnabled && !!config.telegramBotToken && !!config.telegramChatId;
    this.chatId = config.telegramChatId;

    if (this.enabled) {
      try {
        this.bot = new TelegramBot(config.telegramBotToken, { polling: true });
        logger.info('Telegram bot initialized with polling');
        this.setupCommands();
      } catch (error) {
        logger.error({ error }, 'Failed to initialize Telegram bot');
        this.enabled = false;
      }
    } else {
      logger.warn('Telegram notifications disabled or not configured');
    }
  }

  private setupCommands(): void {
    if (!this.bot) return;

    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const fromBot = msg.from?.is_bot;
      
      if (fromBot) return;
      
      if (text === '/scrape' || text === '/run' || text === '/start') {
        logger.info({ chatId, command: text }, 'Received scrape command');
        
        await this.bot?.sendMessage(chatId, '🚀 Starting the scraping process...');
        
        if (this.commandHandler) {
          try {
            await this.commandHandler();
            await this.bot?.sendMessage(chatId, '✅ Scraping completed successfully!');
          } catch (error) {
            logger.error({ error }, 'Error during command execution');
            await this.bot?.sendMessage(chatId, '❌ Error during scraping: ' + (error instanceof Error ? error.message : 'Unknown error'));
          }
        } else {
          await this.bot?.sendMessage(chatId, '⚠️ No command handler registered');
        }
      } else if (text === '/help') {
        await this.bot?.sendMessage(chatId, 
          '📋 *Available Commands:*\n\n' +
          '/scrape - Run the appointment scraper\n' +
          '/run - Same as /scrape\n' +
          '/start - Same as /scrape\n' +
          '/help - Show this help message',
          { parse_mode: 'Markdown' }
        );
      }
    });

    logger.info('Telegram commands registered');
  }

  setCommandHandler(handler: CommandHandler): void {
    this.commandHandler = handler;
    logger.info('Command handler registered');
  }

  async sendReport(_report: ReportData, reportText: string): Promise<TelegramResult> {
    if (!this.enabled || !this.bot) {
      logger.warn('Telegram not enabled or bot not initialized');
      return { success: false, error: 'Telegram not configured' };
    }

    try {
      logger.info({ chatId: this.chatId }, 'Sending report to Telegram');

      const sentMessage = await this.bot.sendMessage(this.chatId, reportText, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });

      logger.info({ messageId: sentMessage.message_id }, 'Report sent to Telegram');

      return {
        success: true,
        messageId: sentMessage.message_id,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to send Telegram message');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendScreenshot(screenshotPath: string, caption?: string): Promise<TelegramResult> {
    if (!this.enabled || !this.bot) {
      return { success: false, error: 'Telegram not configured' };
    }

    if (!fs.existsSync(screenshotPath)) {
      logger.warn({ screenshotPath }, 'Screenshot file not found');
      return { success: false, error: 'Screenshot file not found' };
    }

    try {
      logger.info({ screenshotPath }, 'Sending screenshot to Telegram');

      const sentPhoto = await this.bot.sendPhoto(this.chatId, screenshotPath, {
        caption: caption || 'Screenshot',
      });

      logger.info({ messageId: sentPhoto.message_id }, 'Screenshot sent to Telegram');

      return {
        success: true,
        messageId: sentPhoto.message_id,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to send screenshot to Telegram');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendAlert(title: string, message: string): Promise<TelegramResult> {
    if (!this.enabled || !this.bot) {
      return { success: false, error: 'Telegram not configured' };
    }

    const alertMessage = `🚨 *${title}*\n\n${message}`;

    try {
      const sent = await this.bot.sendMessage(this.chatId, alertMessage, {
        parse_mode: 'Markdown',
      });

      return { success: true, messageId: sent.message_id };
    } catch (error) {
      logger.error({ error }, 'Failed to send alert to Telegram');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export function createTelegramService(config: Config): TelegramService {
  return new TelegramService(config);
}