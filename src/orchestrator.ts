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

const indexNameFromFilename = (filename: string) =>
  filename.substring(0, filename.length - 5)

const indexConfigFromFile = (
  filename: string,
  indexConfigFileFolder: string,
) => {
  const configBuffer = fs.readFileSync(`${indexConfigFileFolder}/${filename}`)
  return JSON.parse(configBuffer.toString())
}

const indicesConfigInconsistency = (
  configIndexNames: string[],
  existingIndices: string[],
) => {
  const intersection = configIndexNames.filter(index =>
    existingIndices.includes(index),
  )

  return intersection.length !== configIndexNames.length
}

export const indicesNeedUpdating = async (
  client: Client,
  indexConfigFiles: string[],
) => {
  const existingIndices = await getExistingIndices(client)
  logger.info(`Existing indices: ${existingIndices.join(',')}`)

  if (existingIndices.length !== indexConfigFiles.length) {
    logger.info(`Indices need to be updated`)
    return true
  }

  const configIndexNames = indexConfigFiles.map(indexNameFromFilename)

  if (indicesConfigInconsistency(configIndexNames, existingIndices)) {
    const indices = existingIndices.join(',')
    const configs = configIndexNames.join(',')
    logger.error(
      `Indices and configurations inconsistent. Indices: [${indices}]. Configurations: [${configs}]`,
    )
    throw Error('Indices are out of sync with configuration files')
  }

  return false
}

export const manageIndices = async (
  client: Client,
  indexConfigFiles: string[],
  indexConfigFileFolder: string,
) => {
  const existingIndices = await getExistingIndices(client)
  const mostRecentIndex = await getMostRecentIndex(client, existingIndices)

  logger.info(
    `Existing indices: ${existingIndices.join(',')}${
      mostRecentIndex ? ` - latest index: ${mostRecentIndex}` : ''
    }`,
  )

  const indicesToFilenames: Record<string, string> = indexConfigFiles.reduce(
    (acc, file) => ({
      ...acc,
      [indexNameFromFilename(file)]: file,
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
