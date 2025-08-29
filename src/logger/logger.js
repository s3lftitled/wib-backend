const { createLogger, format, transports } = require('winston')
const { combine, timestamp, printf, colorize } = format

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

// Define custom log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  debug: 'blue',
  verbose: 'magenta',
  silly: 'gray'
}

require('winston').addColors(colors)

// Function to format stack trace to be more readable
const formatStack = (stack) => {
  if (!stack) return ''
  return stack
    .split('\n')
    .slice(0, 4)  // Take first 4 lines of stack trace
    .map(line => line.trim())
    .join('\n    ')  // Indent stack lines
}

// Get log level based on environment
const getLogLevel = () => {
  switch (process.env.NODE_ENV) {
    case 'development':
      return 'debug'
    case 'production':
      return 'info'
    case 'test':
      return 'warn'
    default:
      return 'info'
  }
}

// Create the logger
const logger = createLogger({
  level: getLogLevel(), // Dynamic log level based on environment
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.splat(),
    format.simple()
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize({
          all: false,
          colors: colors,
          level: true
        }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(info => {
          if (isProduction) {
            // Compact production format - single line
            let output = `${info.timestamp} [${info.level}]`
            
            if (info.prefix === 'HTTP Error') {
              output += ' [HTTP Error]'
            }
            
            output += ` ${info.message}`
            
            // Add route and status inline for production
            if (info.method && info.route) {
              output += ` | ${info.method} ${info.route}`
            }
            
            if (info.statusCode) {
              output += ` | Status: ${info.statusCode}`
            }
            
            if (info.ip) {
              output += ` | IP: ${info.ip}`
            }
            
            return output
          }
          
          // Detailed development format (your current format)
          let output = `${info.timestamp} [${info.level}]`

          if (info.prefix === 'HTTP Error') {
            output += ' [HTTP Error]'
          }

          output += ` ${info.message}`

          if (info.method && info.route) {
            output += `\n    Route: ${info.method} ${info.route}`
          }

          if (info.statusCode) {
            output += `\n    Status: ${info.statusCode}`
          }

          if (info.ip) {
            output += `\n    IP: ${info.ip}`
          }

          if (info.params && Object.keys(info.params).length > 0) {
            output += `\n    Params: ${JSON.stringify(info.params)}`
          }

          if (info.query && Object.keys(info.query).length > 0) {
            output += `\n    Query: ${JSON.stringify(info.query)}`
          }

          if (info.stack) {
            output += '\n    Stack:\n    ' + formatStack(info.stack)
          }

          return output
        })
      ),
    }),
    new transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: format.uncolorize() // Remove colors for file output
    }),
    new transports.File({ 
      filename: 'logs/combined.log',
      format: format.uncolorize() // Remove colors for file output
    })
  ]
})

// Environment-based request logging
logger.logRequest = (req, res, next) => {
  if (isDevelopment) {
    // Verbose logging for development
    logger.info(`Incoming ${req.method} request`, {
      method: req.method,
      route: req.originalUrl,
      params: req.params,
      query: Object.keys(req.query).length ? req.query : undefined,
      ip: req.ip
    })
  } else {
    // Concise logging for production
    logger.info(`${req.method} ${req.originalUrl}`, {
      method: req.method,
      route: req.originalUrl,
      params: req.params,
      ip: req.ip
    })
  }
  next()
}

// Environment-based error logging
logger.logError = (error, req) => {
  const baseLogData = {
    prefix: 'HTTP Error',
    route: req?.originalUrl,
    method: req?.method,
    ip: req?.ip,
    statusCode: error.statusCode || 500,
    params: req?.params,
    query: req?.query
  }

  if (isDevelopment) {
    // Full stack trace in development
    logger.error(error.message || 'Unknown error', {
      ...baseLogData,
      stack: error.stack
    })
  } else {
    // Smart error logging for production
    const statusCode = error.statusCode || 500
    
    if (statusCode >= 500) {
      // Server errors (5xx) get full logging even in production
      logger.error(error.message || 'Unknown error', {
        ...baseLogData,
        stack: error.stack
      })
    } else {
      // Client errors (4xx) get minimal logging in production
      logger.warn(error.message || 'Unknown error', baseLogData)
    }
  }
}

// Environment-based info logging
logger.logInfo = (message, req, additionalData = {}) => {
  if (isDevelopment) {
    // Detailed logging for development
    logger.info(message, {
      method: req?.method,
      route: req?.originalUrl,
      params: req?.params,
      query: req?.query && Object.keys(req.query).length ? req.query : undefined,
      ip: req?.ip,
      ...additionalData
    })
  } else {
    // Concise logging for production
    logger.info(message, {
      method: req?.method,
      route: req?.originalUrl,
      ip: req?.ip,
      ...additionalData
    })
  }
}

module.exports = logger