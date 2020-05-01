export const groupFileNames = (fileNames: string[]): Record<string, string[]> =>
  fileNames.reduce<Record<string, string[]>>((groupedFileNames, fileName) => {
    const filePrefix = fileName
      .split('-')
      .slice(0, -1)
      .join('-')

    return {
      ...groupedFileNames,
      [filePrefix]: [...(groupedFileNames[filePrefix] || []), fileName],
    }
  }, {})
