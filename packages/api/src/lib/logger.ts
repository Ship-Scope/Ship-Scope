type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const isTest = process.env.NODE_ENV === 'test';
const isProd = process.env.NODE_ENV === 'production';

function shouldLog(level: LogLevel): boolean {
  if (isTest && level !== 'error') return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  if (isProd) {
    return JSON.stringify({
      level,
      msg: message,
      service: 'shipscope-api',
      ts: new Date().toISOString(),
      ...meta,
    });
  }
  const prefix = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)}`;
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${prefix} ${message}${metaStr}`;
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog('debug')) console.debug(formatEntry('debug', msg, meta));
  },
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog('info')) console.log(formatEntry('info', msg, meta));
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog('warn')) console.warn(formatEntry('warn', msg, meta));
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog('error')) {
      const safeMeta = meta ? { ...meta } : {};
      if (isProd) {
        delete safeMeta.stack;
      }
      console.error(formatEntry('error', msg, safeMeta));
    }
  },
};
