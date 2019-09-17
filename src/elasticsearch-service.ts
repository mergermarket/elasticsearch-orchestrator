import { Client } from '@elastic/elasticsearch'
import {
  createAWSConnection,
  awsCredsifyAll,
  awsGetCredentials,
} from '@acuris/aws-es-connection'

import { config } from './env'
import logger from './logger'

const REINDEX_POLLING_MS = 3000

const validateUrl = (url: string) =>
  url.startsWith('http') ? url : `https://${url}`

export const createElasticsearchClient = async (
  endpoint: string,
): Promise<Client> => {
  const credentials = await awsGetCredentials()
  const AWSConnection = createAWSConnection(credentials)

  return awsCredsifyAll(
    new Client({
      node: validateUrl(endpoint),
      Connection: AWSConnection,
    }),
  )
}

const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const startReindex = async (
  client: Client,
  sourceIndex: string,
  destIndex: string,
) => {
  try {
    const {
      body: { task, failures },
    } = await client.reindex({
      refresh: true,
      // eslint-disable-next-line @typescript-eslint/camelcase
      wait_for_completion: false,
      body: {
        source: {
          index: sourceIndex,
        },
        dest: {
          index: destIndex,
          // eslint-disable-next-line @typescript-eslint/camelcase
          version_type: 'internal',
        },
      },
    })

    if (failures && failures.length > 0) {
      throw new Error(`Failures: ${failures.join(',')}`)
    }

    return task
  } catch (err) {
    logger.error(`Could not reindex ${sourceIndex} -> ${destIndex}`, err)
    throw err
  }
}

export const getExistingIndices = async (client: Client): Promise<string[]> => {
  const { body } = await client.indices.stats({ index: '*' })
  return Object.keys(body.indices).filter(index => !index.startsWith('.'))
}

export const getMostRecentIndex: (
  client: Client,
  indexes: string[],
) => Promise<string | undefined> = async (client, indexes) => {
  if (!indexes.length) {
    return
  }

  const { body } = await client.indices.get({
    index: indexes.join(','),
  })

  const [latestIndex] = Object.keys(body)
    .map((index: string) => ({
      index,
      // eslint-disable-next-line @typescript-eslint/camelcase
      creation_date: body[index].settings.index.creation_date,
    }))
    .sort((a, b) => (a.creation_date > b.creation_date ? -1 : 1))

  return latestIndex && latestIndex.index
}

export const pollReindexForCompletion = async (
  client: Client,
  taskId: string,
  pollingDelay: number = REINDEX_POLLING_MS,
) => {
  const { body } = await client.tasks.get({
    // eslint-disable-next-line @typescript-eslint/camelcase
    task_id: taskId,
  })

  const { error, completed, task } = body

  if (error) {
    logger.error(`Error fetching task ${taskId}`, error)
    throw error
  }

  logger.info(
    `[${task.node}] ${task.description}: ${task.status.created}/${task.status.total} documents`,
  )

  if (completed) {
    return
  }

  await waitFor(pollingDelay)
  await pollReindexForCompletion(client, taskId, pollingDelay)
}

export const reindex = async (
  client: Client,
  sourceIndex: string | undefined,
  destIndex: string,
) => {
  if (!sourceIndex) {
    return Promise.resolve(false)
  }

  const taskId = await startReindex(client, sourceIndex, destIndex)

  return pollReindexForCompletion(client, taskId)
}

export const createIndex = async (
  client: Client,
  index: string,
  mapping: {},
): Promise<string> => {
  try {
    const { body } = await client.indices.create({
      index,
        body: {
          mappings: mapping,
          // eslint-disable-next-line @typescript-eslint/camelcase
          settings: { number_of_shards: config.NUMBER_OF_SHARDS },
        },
      // eslint-disable-next-line @typescript-eslint/camelcase
      include_type_name: false,
    })
    logger.info(`Created index ${body.index}`)

    return index
  } catch (err) {
    logger.error(`Could not create index ${index}`, err)
    throw err
  }
}

export const deleteIndex = async (
  client: Client,
  index: string,
): Promise<boolean> => {
  try {
    await client.indices.delete({ index })
    logger.info(`Deleted index ${index}`)
    return true
  } catch (err) {
    logger.error(`Could not delete index ${index}`, err)
    throw err
  }
}

export const deleteAllIndices = async (client: Client): Promise<void> => {
  await client.indices.delete({
    index: '*',
  })
}
