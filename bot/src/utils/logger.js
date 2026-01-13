import winston from 'winston';

// Custom format for better readability
const customFormat = winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
  let metaStr = '';
  if (Object.keys(meta).length > 0) {
    metaStr = '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ');
  }
  return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug', // Changed default to 'debug' for more visibility
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat()
  ),
  defaultMeta: { service: 'fix-flow-bot' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      )
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({
      filename: 'combined.log',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
      )
    }),
  ],
});

// Always log to console for development debugging
logger.add(new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    customFormat
  )
}));

// Helper function to log with context
logger.logWithContext = (level, message, context = {}) => {
  logger.log(level, message, context);
};

// Helper to log request details
logger.logRequest = (req, message = 'Incoming request') => {
  logger.debug(message, {
    method: req.method,
    path: req.path,
    query: req.query,
    headers: {
      'content-type': req.headers['content-type'],
      'x-api-key': req.headers['x-api-key'] ? '[PRESENT]' : '[MISSING]',
      'authorization': req.headers['authorization'] ? '[PRESENT]' : '[MISSING]',
      'x-github-event': req.headers['x-github-event']
    }
  });
};

// Helper to log database queries
logger.logQuery = (query, params = []) => {
  logger.debug('Database query', {
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
    paramCount: params.length
  });
};

export default logger;