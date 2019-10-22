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

logger.info(`Setting AWS region to ${config.AWS_REGION}`)
AWS.config.update({
  region: config.AWS_REGION,
})

const mappingsFolder = config.MAPPINGS_FOLDER || '/mappings'
const mappingFiles = fs.readdirSync(mappingsFolder)
if (mappingFiles.length == 0) {
  console.error('no mapping files')
  process.exit(1)
}

async function main() {
  const client = await createElasticsearchClient(config.ELASTICSEARCH_ENDPOINT)

  await disableAutomaticIndexCreation(client)

  if (!(await indicesNeedUpdating(client, mappingFiles))) {
    logger.info(`indexes up to date`)
    return
  }

  if (config.SCALE_DOWN_SERVICE) {
    await scaleDownIngesterService(config.SCALE_DOWN_SERVICE)
  }

  if (config.MANAGE_INDICES === 'true') {
    await manageIndices(client, mappingFiles, mappingsFolder)
  }
}

main().catch(err => {
  console.error('Failed when trying to create client', err)
  logger.error('Failed when trying to create client', err)
  process.exit(1)
})
