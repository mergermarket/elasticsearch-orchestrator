import fs from 'fs'
import AWS from 'aws-sdk'

import { createElasticsearchClient } from './elasticsearch-service'
import {
  manageIndices,
  indicesNeedUpdating,
  disableAutomaticIndexCreation,
  scaleDownIngesterService,
} from './orchestrator'
import { config } from './env'
import logger from './logger'
import { groupFileNames } from './helpers'

logger.info(`Setting AWS region to ${config.AWS_REGION}`)
AWS.config.update({
  region: config.AWS_REGION,
})

const indexConfigFolder = config.INDEX_CONFIG_FOLDER || '/index-configs'
const indexConfigFiles = fs.readdirSync(indexConfigFolder)
if (indexConfigFiles.length == 0) {
  console.error('no index config files')
  process.exit(1)
}

async function main() {
  const client = await createElasticsearchClient(config.ELASTICSEARCH_ENDPOINT)

  await disableAutomaticIndexCreation(client)

  if (!(await indicesNeedUpdating(client, indexConfigFiles))) {
    logger.info(`indexes up to date`)
    return
  }

  if (config.SCALE_DOWN_SERVICE) {
    await scaleDownIngesterService(config.SCALE_DOWN_SERVICE)
  }

  if (config.MANAGE_INDICES === 'true') {
    const groupedConfigFiles = groupFileNames(indexConfigFiles)
    await Promise.all(
      Object.values(groupedConfigFiles).map(configFiles =>
        manageIndices(client, configFiles, indexConfigFolder),
      ),
    )
  }
}

main().catch(err => {
  console.error('Failed when trying to create client', err)
  logger.error('Failed when trying to create client', err)
  process.exit(1)
})
