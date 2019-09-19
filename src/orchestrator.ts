import fs from 'fs'
import AWS from 'aws-sdk'
import { Client } from '@elastic/elasticsearch'

import {
  createIndex,
  deleteIndex,
  getExistingIndices,
  getMostRecentIndex,
  reindex
} from './elasticsearch-service'
import logger from './logger'

const indexNameFromFilename = (filename: string) =>
  filename.substring(0, filename.length - 5)

const mappingFromFile = (filename: string, mappingFileFolder: string) => {
  const mappingBuffer = fs.readFileSync(`${mappingFileFolder}/${filename}`)
  return JSON.parse(mappingBuffer.toString())
}

const indicesMappingInconsistency = (
  mappingIndexNames: string[],
  existingIndices: string[]
) => {
  const intersection = mappingIndexNames.filter(index =>
    existingIndices.includes(index)
  )

  return intersection.length !== mappingIndexNames.length
}

export const indicesNeedUpdating = async (
  client: Client,
  mappingFiles: string[]
) => {
  const existingIndices = await getExistingIndices(client)
  logger.info(`Existing indices: ${existingIndices.join(',')}`)

  if (existingIndices.length !== mappingFiles.length) {
    logger.info(`Indices need to be updated`)
    return true
  }

  const mappingIndexNames = mappingFiles.map(indexNameFromFilename)

  if (indicesMappingInconsistency(mappingIndexNames, existingIndices)) {
    const indices = existingIndices.join(',')
    const mappings = mappingIndexNames.join(',')
    logger.error(
      `Indices and mappings inconsistent. Indices: [${indices}]. Mapping: [${mappings}]`
    )
    throw Error('Indices are out of sync with mapping files')
  }

  return false
}

export const manageIndices = async (
  client: Client,
  mappingFiles: string[],
  mappingFileFolder: string
) => {
  const existingIndices = await getExistingIndices(client)
  const mostRecentIndex = await getMostRecentIndex(client, existingIndices)

  logger.info(
    `Existing indices: ${existingIndices.join(',')}${
      mostRecentIndex ? ` - latest index: ${mostRecentIndex}` : ''
    }`
  )

  const indicesToFilenames: Record<string, string> = mappingFiles.reduce(
    (acc, file) => ({
      ...acc,
      [indexNameFromFilename(file)]: file
    }),
    {}
  )

  const createIndices = Object.keys(indicesToFilenames)
    .filter(index => !existingIndices.includes(index))
    .map(index => {
      logger.info(`Creating new index ${index}`)
      return createIndex(
        client,
        index,
        mappingFromFile(indicesToFilenames[index], mappingFileFolder)
      )
    })

  const createdIndices = await Promise.all(createIndices)
  await Promise.all(
    createdIndices.map((index: string) =>
      reindex(client, mostRecentIndex, index)
    )
  )

  const orphanedIndices = existingIndices.filter(
    index => !Object.keys(indicesToFilenames).includes(index)
  )
  logger.info(`Orphaned indices: ${orphanedIndices.join(',')}`)
  const deletedIndices = orphanedIndices.map(index =>
    deleteIndex(client, index)
  )

  await Promise.all(deletedIndices)
}

export const disableAutomaticIndexCreation = async (client: Client) => {
  await client.cluster.putSettings({
    body: {
      persistent: {
        'action.auto_create_index': 'false'
      }
    }
  })
}

export const scaleDownIngesterService = async (
  service: string
): Promise<void> => {
  logger.info(`Scaling down - ${service}`)
  const ecs = new AWS.ECS()
  await ecs
    .updateService({
      service,
      desiredCount: 0
    })
    .promise()
  await ecs.waitFor('servicesStable', { services: [service] }).promise()
  logger.info(`Scaling down succeeded - ${service}`)
}
