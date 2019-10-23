import { Client } from '@elastic/elasticsearch'

import { manageIndices, indicesNeedUpdating } from '../orchestrator'
import {
  getExistingIndices,
  deleteAllIndices,
  getMostRecentIndex,
  createElasticsearchClient,
} from '../elasticsearch-service'
import { config } from '../env'
import axios from 'axios'

describe('elastic orchestrator', () => {
  describe('indices need updating', () => {
    const indexConfigFile = 'index-00001.json'
    const anotherConfigFile = 'index-00002.json'
    const indexConfigFileFolder = './src/__fixtures__'

    let client: Client

    beforeEach(async () => {
      client = await createElasticsearchClient(config.ELASTICSEARCH_ENDPOINT)
    })

    afterEach(async () => {
      await deleteAllIndices(client)
      const indices = await getExistingIndices(client)
      expect(indices).toHaveLength(0)
      await client.close()
    })

    it('indicates indices need managing if we have a configuration file without a corresponding index', async () => {
      const shouldUpdate = await indicesNeedUpdating(client, [indexConfigFile])
      expect(shouldUpdate).toBe(true)
    })

    it('indicates indices need managing if we have an index without a corresponding configuration file', async () => {
      await manageIndices(client, [indexConfigFile], indexConfigFileFolder)
      const shouldUpdate = await indicesNeedUpdating(client, [])
      expect(shouldUpdate).toBe(true)
    })

    it('indicates indices do not need managing if only indices with configuration files exist', async () => {
      await manageIndices(client, [indexConfigFile], indexConfigFileFolder)
      const shouldUpdate = await indicesNeedUpdating(client, [indexConfigFile])
      expect(shouldUpdate).toBe(false)
    })

    it('will throw an error if the count of configuration files is the same as the indices but the index names do not match', async () => {
      const throws = async () => {
        await manageIndices(client, [indexConfigFile], indexConfigFileFolder)
        await indicesNeedUpdating(client, [anotherConfigFile])
      }
      await expect(throws()).rejects.toThrow()
    })
  })

  describe('managing indexes', () => {
    const indexToCreate = 'index-00001'
    const indexConfigFile = 'index-00001.json'
    const indexConfigFileFolder = './src/__fixtures__'

    const createBulkPayload = (count: number) =>
      new Array(count)
        .fill(0)
        .map((_: undefined, value: number) => {
          return [
            JSON.stringify({ index: {} }),
            JSON.stringify({
              name: `name-${value}`,
            }),
          ].join('\n')
        })
        .join('\n') + '\n'

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const insertBulk = async (
      client: Client,
      index: string | undefined,
      data: any,
    ) => {
      if (!index) return

      await client.bulk({
        index,
        type: '_doc',
        body: data,
        refresh: 'true',
      })
    }

    const getIndexDocuments = async (index: string) => {
      const { data } = await axios.get(
        `${config.ELASTICSEARCH_ENDPOINT}/${index}/_search?q=*`,
      )

      return data.hits.hits.map((doc: any) => doc._source)
    }

    let client: Client

    beforeEach(async () => {
      client = await createElasticsearchClient(config.ELASTICSEARCH_ENDPOINT)
    })

    afterEach(async () => {
      await deleteAllIndices(client)
      const indices = await getExistingIndices(client)
      expect(indices).toHaveLength(0)
      await client.close()
    })

    it('will create an index for a given configuration file if it did not exist', async () => {
      await manageIndices(client, [indexConfigFile], indexConfigFileFolder)

      const indices = await getExistingIndices(client)
      expect(indices).toContainEqual(indexToCreate)
    })

    it('will delete an orphaned index with no configuration file', async () => {
      await manageIndices(client, ['index-00000.json'], indexConfigFileFolder)
      let indices = await getExistingIndices(client)
      expect(indices).toContain('index-00000')

      await manageIndices(client, [indexConfigFile], indexConfigFileFolder)
      indices = await getExistingIndices(client)
      expect(indices).not.toContain('index-00000')
    })

    it('will trigger a reindex from the most recent index to the newly added index', async () => {
      const existingConfig = ['index-00000.json', 'index-00001.json']
      await manageIndices(client, existingConfig, indexConfigFileFolder)

      const indices = await getExistingIndices(client)
      const latestIndex = await getMostRecentIndex(client, indices)

      await insertBulk(client, latestIndex, createBulkPayload(5))

      await manageIndices(
        client,
        [...existingConfig, 'index-00002.json'],
        indexConfigFileFolder,
      )

      const oldIndexDocuments = await getIndexDocuments('index-00001')
      const newIndexDocuments = await getIndexDocuments('index-00002')

      expect(newIndexDocuments).toEqual(oldIndexDocuments)
    })
  })
})
