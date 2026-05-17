# Halo Automation Agent

Autonomous AI automation agent for Halo Telehealth platform - generates daily reports for appointments with missing EMD Appointment IDs.

## Overview

The Halo Automation Agent is a production-ready automation system that:

- Runs daily at a scheduled time (configurable)
- Logs into the Halo Telehealth platform via browser automation
- Navigates to Appointments section and filters for today's appointments
- Identifies all appointments where "EMD Appointment ID" is missing/empty/null/invalid
- Generates comprehensive reports (Markdown and HTML)
- Sends reports to Telegram
- Saves reports locally
- Handles failures gracefully with retry logic, screenshots, and alerts

## Features

- **Browser Automation**: Playwright-based browser automation
- **Smart Filtering**: Automatically filters today's appointments
- **Robust Error Handling**: Retry logic, screenshot capture on failure
- **Multiple Report Formats**: Markdown and HTML output
- **Telegram Integration**: Instant notifications with report summary
- **Scheduled Execution**: Cron-based daily scheduling
- **Production Ready**: Docker, PM2, comprehensive logging

## Project Structure

```
HaloAutomationAgent/
├── src/
│   ├── config/          # Configuration management
│   │   └── index.ts     # Env variable loading & validation
│   ├── services/        # Core services
│   │   ├── agent.ts     # Main orchestration logic
│   │   ├── browser.ts   # Playwright browser automation
│   │   ├── scraper.ts   # Appointment data extraction
│   │   ├── report.ts    # Report generation
│   │   ├── telegram.ts  # Telegram notifications
│   │   └── scheduler.ts # Cron scheduling
│   ├── types/           # TypeScript definitions
│   │   └── index.ts
│   ├── utils/           # Utilities
│   │   └── logger.ts    # Pino logging
│   └── index.ts         # Entry point
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js
├── .env.example
└── README.md
```

## Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- Ubuntu 22.04 (for production deployment)
- Chrome/Chromium (installed via Playwright)

## Installation

```bash
# Clone the repository
cd HaloAutomationAgent

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Platform Configuration
PLATFORM_URL=http://your-platform-url.com
FRONTEND_URL=http://your-frontend-url.com

# Login Credentials
HALO_EMAIL=admin@yourdomain.com
HALO_PASSWORD=your_secure_password

# Telegram Configuration (optional but recommended)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_ENABLED=true

# Scheduling (cron expression)
# Default: Daily at 8:00 AM
SCHEDULE_CRON=0 8 * * *

# Browser Configuration
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=30000

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY_MS=5000

# Logging
LOG_LEVEL=info
LOG_PRETTY=true
```

### Getting Telegram Bot Token

1. Open Telegram and search for @BotFather
2. Create a new bot: `/newbot`
3. Copy the bot token
4. Start a chat with your bot
5. Get your chat ID: Send a message to the bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates`

## Usage

### Development Mode (with hot reload)

```bash
npm run dev
```

### Production Mode

```bash
# Build first
npm run build

# Run
npm start
```

### Run Once (for testing)

```bash
RUN_ONCE=true npm start
```

### With Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Run once (for testing)
docker-compose --profile once up
```

### With PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js

# View logs
pm2 logs halo-automation-agent

# Monitor
pm2 monit

# Restart
pm2 restart halo-automation-agent

# Stop
pm2 stop halo-automation-agent

# Setup startup script
pm2 startup
pm2 save
```

## Deployment

### Ubuntu 22.04 Server Deployment

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Clone and setup
cd /opt
sudo git clone <your-repo>/HaloAutomationAgent.git
cd HaloAutomationAgent
sudo cp .env.example .env
sudo nano .env  # Configure your settings

# 4. Install dependencies and build
sudo npm install
sudo npm run build

# 5. Setup PM2 for auto-restart
sudo npm install -g pm2
sudo pm2 start ecosystem.config.js
sudo pm2 save
sudo pm2 startup  # Follow the instructions

# 6. (Optional) Setup log rotation
sudo pm2 install pm2-logrotate
```

### Docker Deployment

```bash
# Build and run with docker-compose
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f --tail=100
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PLATFORM_URL` | Platform API URL | Required |
| `FRONTEND_URL` | Frontend URL | Required |
| `HALO_EMAIL` | Login email | Required |
| `HALO_PASSWORD` | Login password | Required |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Optional |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | Optional |
| `TELEGRAM_ENABLED` | Enable Telegram | `true` |
| `SCHEDULE_CRON` | Cron schedule | `0 8 * * *` |
| `REPORT_SAVE_DIR` | Report output dir | `./reports` |
| `REPORT_FORMAT` | `markdown` or `html` | `markdown` |
| `BROWSER_HEADLESS` | Run browser headless | `true` |
| `BROWSER_TIMEOUT` | Browser timeout (ms) | `30000` |
| `MAX_RETRIES` | Max retry attempts | `3` |
| `LOG_LEVEL` | Log level | `info` |

## Troubleshooting

### Browser fails to start

```bash
# Install Chrome dependencies
npx playwright install --with-deps chromium
```

### Login fails

- Verify credentials in `.env`
- Check if frontend URL is correct
- Check network connectivity
- Review screenshots in `screenshots/` folder

### Telegram not receiving messages

- Verify bot token and chat ID
- Ensure bot was started (sent /start)
- Check logs for errors

### Scheduling not working

- Verify cron expression format
- Check system timezone
- Review logs for scheduling errors

## Monitoring

### PM2 Commands

```bash
# View all processes
pm2 list

# View detailed info
pm2 show halo-automation-agent

# View logs
pm2 logs halo-automation-agent --err --lines 50

# Restart on failure
pm2 restart halo-automation-agent
```

### Log Locations

- PM2: `logs/agent-*.log`
- Application: Console output
- Docker: `docker-compose logs`

## Report Output

Reports are saved to `./reports/` (configurable):

- `emd-report-YYYY-MM-DD.md` - Markdown report
- `emd-report-YYYY-MM-DD.html` - HTML report (if enabled)

Report format:

```markdown
# EMD Appointment ID Report

**Generated:** 2024-01-15 08:30:00
**Total Appointments Checked:** 45
**Missing EMD ID Count:** 3

## Appointments with Missing EMD IDs

| Patient Name | Appointment Time | Doctor Name | Appointment ID | EMD Appointment ID | Status |
|--------------|-------------------|-------------|----------------|---------------------|--------|
| John Doe | 09:00 AM | Dr. Smith | APP-123 | ❌ MISSING | Scheduled |
```

## License

Proprietary - Halo Telehealth

## Support

For issues, contact the development team.