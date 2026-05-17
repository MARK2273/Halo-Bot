export interface Appointment {
  patientName: string;
  appointmentTime: string;
  doctorName: string;
  appointmentId: string;
  amd_appointment_id: string | null | undefined;
  status: string;
}

export interface ReportData {
  generatedAt: string;
  totalAppointments: number;
  missingEmdCount: number;
  appointments: Appointment[];
}

export interface Config {
  nodeEnv: string;
  platformUrl: string;
  frontendUrl: string;
  haloEmail: string;
  haloPassword: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  reportTimezone: string;
  reportSaveDir: string;
  reportFormat: 'markdown' | 'html';
  scheduleCron: string;
  browserHeadless: boolean;
  browserTimeout: number;
  browserViewportWidth: number;
  browserViewportHeight: number;
  browserScreenshotsDir: string;
  maxRetries: number;
  retryDelayMs: number;
  logLevel: string;
  logPretty: boolean;
}

export interface ScraperResult {
  success: boolean;
  data?: Appointment[];
  error?: string;
  screenshotPath?: string;
}

export interface TelegramResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

export interface ScheduleJob {
  name: string;
  cron: string;
  callback: () => Promise<void>;
  running: boolean;
}