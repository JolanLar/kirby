type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LEVELS: Record<LogLevel, number> = {
  silent: -1,
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function parseLogLevel(value: string | undefined): LogLevel {
  const normalized = String(value || 'info').toLowerCase();
  if (normalized in LEVELS) return normalized as LogLevel;
  return 'info';
}

const activeLevel = parseLogLevel(process.env.LOG_LEVEL);

function shouldLog(level: Exclude<LogLevel, 'silent'>): boolean {
  return LEVELS[activeLevel] >= LEVELS[level];
}

function write(level: Exclude<LogLevel, 'silent'>, args: unknown[]) {
  if (!shouldLog(level)) return;
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

export const logger = {
  level: activeLevel,
  error: (...args: unknown[]) => write('error', args),
  warn: (...args: unknown[]) => write('warn', args),
  info: (...args: unknown[]) => write('info', args),
  debug: (...args: unknown[]) => write('debug', args),
};
