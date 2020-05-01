import { groupFileNames } from '../helpers'

describe('filename grouping', () => {
  it('groups file names by prefix', () => {
    const fileNames = [
      'index-00001.json',
      'index-00002.json',
      'another-index-00001.json',
    ]

    const groupedFileNames = groupFileNames(fileNames)
    expect(groupedFileNames).toStrictEqual({
      index: ['index-00001.json', 'index-00002.json'],
      'another-index': ['another-index-00001.json'],
    })
  })
})
