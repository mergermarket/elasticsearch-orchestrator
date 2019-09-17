import { createLogger, format, transports } from 'winston'

import { config } from './env'

const logger = createLogger({
  exitOnError: false,
  defaultMeta: {
    env: config.ENV,
  },
  transports: [
    new transports.Console({
      handleExceptions: true,
      level: config.LOG_LEVEL,
      format: format.combine(
        format.timestamp(),
        format.json(),
        format.errors({ stack: true }),
      ),
    }),
  ],
})

export default logger
