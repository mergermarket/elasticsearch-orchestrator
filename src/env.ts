const env = process.env.ENV_NAME || 'local'

export const config = {
  ENV: env,
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  ELASTICSEARCH_ENDPOINT: process.env.ELASTICSEARCH_ENDPOINT || '',
  SCALE_DOWN_SERVICE: process.env.SCALE_DOWN_SERVICE || '',
}

export type Config = typeof config
