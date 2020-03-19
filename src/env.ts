const env = process.env.ENV_NAME || 'local'

export const config = {
  ENV: env,
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  ELASTICSEARCH_ENDPOINT: process.env.ELASTICSEARCH_ENDPOINT || '',
  SCALE_DOWN_SERVICE: process.env.SCALE_DOWN_SERVICE || '',
  NUMBER_OF_SHARDS: process.env.NUMBER_OF_SHARDS || 1,
  NUMBER_OF_REPLICAS: process.env.NUMBER_OF_REPLICAS || 1,
  AWS_REGION: process.env.AWS_DEFAULT_REGION || '',
  MANAGE_INDICES: process.env.MANAGE_INDICES || undefined,
  INDEX_CONFIG_FOLDER: process.env.INDEX_CONFIG_FOLDER,
}

export type Config = typeof config
