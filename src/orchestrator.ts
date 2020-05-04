import fs from 'fs'
import AWS from 'aws-sdk'
import { Client } from '@elastic/elasticsearch'

import {
  createIndex,
  deleteIndex,
  getExistingIndices,
  getMostRecentIndex,
  reindex,
} from './elasticsearch-service'
import logger from './logger'

const indexConfigFromFile = (
  filename: string,
  indexConfigFileFolder: string,
) => {
  const configBuffer = fs.readFileSync(`${indexConfigFileFolder}/${filename}`)
  return JSON.parse(configBuffer.toString())
}

const excludeExtension = (filename: string) =>
  filename
    .split('.')
    .slice(0, -1)
    .join('.')

export const indicesNeedUpdating = async (
  client: Client,
  indexConfigFiles: string[],
) => {
  const existingIndices = await getExistingIndices(client)
  logger.info(`Existing indices: ${existingIndices.join(',')}`)

  if (
    indexConfigFiles.length !== existingIndices.length ||
    indexConfigFiles.some(
      localIndex =>
        existingIndices.indexOf(excludeExtension(localIndex)) === -1,
    )
  ) {
    logger.info(`Indices need to be updated`)
    return true
  }

  return false
}

export const manageIndices = async (
  client: Client,
  indexPrefix: string,
  indexConfigFiles: string[],
  indexConfigFileFolder: string,
) => {
  const unfilteredIndices = await getExistingIndices(client)
  const existingIndices = unfilteredIndices.filter(index =>
    index.startsWith(indexPrefix),
  )
  const mostRecentIndex = await getMostRecentIndex(client, existingIndices)

  logger.info(
    `Existing indices: ${existingIndices.join(',')}${
      mostRecentIndex ? ` - latest index: ${mostRecentIndex}` : ''
    }`,
  )

  const indicesToFilenames: Record<string, string> = indexConfigFiles.reduce(
    (acc, file) => ({
      ...acc,
      [excludeExtension(file)]: file,
    }),
    {},
  )

  const createIndices = Object.keys(indicesToFilenames)
    .filter(index => !existingIndices.includes(index))
    .map(index => {
      logger.info(`Creating new index ${index}`)
      return createIndex(
        client,
        index,
        indexConfigFromFile(indicesToFilenames[index], indexConfigFileFolder),
      )
    })

  const createdIndices = await Promise.all(createIndices)
  await Promise.all(
    createdIndices.map((index: string) =>
      reindex(client, mostRecentIndex, index),
    ),
  )

  const orphanedIndices = existingIndices.filter(
    index => !Object.keys(indicesToFilenames).includes(index),
  )
  logger.info(`Orphaned indices: ${orphanedIndices.join(',')}`)
  const deletedIndices = orphanedIndices.map(index =>
    deleteIndex(client, index),
  )

  await Promise.all(deletedIndices)
}

export const disableAutomaticIndexCreation = async (client: Client) => {
  await client.cluster.putSettings({
    body: {
      persistent: {
        'action.auto_create_index': 'false',
      },
    },
  })
}

export const scaleDownIngesterService = async (
  service: string,
): Promise<void> => {
  logger.info(`Scaling down - ${service}`)
  const ecs = new AWS.ECS()
  await ecs
    .updateService({
      service,
      desiredCount: 0,
    })
    .promise()
  await ecs.waitFor('servicesStable', { services: [service] }).promise()
  logger.info(`Scaling down succeeded - ${service}`)
}
