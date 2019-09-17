import fs from 'fs'
import { createElasticsearchClient } from './elasticsearch-service'
import { manageIndices, indicesNeedUpdating, disableAutomaticIndexCreation, scaleDownIngesterService } from './orchestrator'
import { config } from './env'
import logger from './logger'

const mappingsFolder = '/mappings'
const mappingFiles = fs.readdirSync(mappingsFolder)

async function main () {
  const client = await createElasticsearchClient(config.ELASTICSEARCH_ENDPOINT)

  await disableAutomaticIndexCreation(client)

  if (! await indicesNeedUpdating(client, mappingFiles)) {
    logger.info(`indexes up to date`)
    return
  }

  if (config.SCALE_DOWN_SERVICE) {
    await scaleDownIngesterService(config.SCALE_DOWN_SERVICE)
  }
  await manageIndices(client, mappingFiles, mappingsFolder)
}
 
main().catch(err => {
  console.error('Failed when trying to create client', err)
  logger.error('Failed when trying to create client', err)
  process.exit(1)
})
