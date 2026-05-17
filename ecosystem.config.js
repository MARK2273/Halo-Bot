module.exports = {
  apps: [
    {
      name: 'halo-automation-agent',
      script: 'dist/index.js',
      cwd: '.',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/agent-error.log',
      out_file: 'logs/agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      restart_delay: 10000,
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 10000,
      instance_var: 'INSTANCE_ID',
    },
  ],
};

module.exports = {
  apps: [
    {
      name: 'halo-automation-agent',
      script: './dist/index.js',
      cwd: '.',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        BROWSER_HEADLESS: 'true',
        LOG_LEVEL: 'info',
      },
      env_development: {
        NODE_ENV: 'development',
        BROWSER_HEADLESS: 'false',
        LOG_LEVEL: 'debug',
      },
      error_file: './logs/agent-error.log',
      out_file: './logs/agent-out.log',
      log_file: './logs/agent-combined.log',
      time: true,
      merge_logs: true,
      restart_delay: 10000,
      wait_ready: true,
      listen_timeout: 30000,
      kill_timeout: 10000,
      instance_var: 'INSTANCE_ID',
    },
  ],
};