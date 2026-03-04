export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test')
      console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: new Date().toISOString() }));
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test')
      console.warn(JSON.stringify({ level: 'warn', msg, ...meta, ts: new Date().toISOString() }));
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() }));
  },
};
