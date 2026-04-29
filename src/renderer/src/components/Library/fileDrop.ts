import { api } from '../../api'

export function getDroppedFilePaths(files: File[]) {
  return files
    .map((file) => {
      const directPath = (file as any).path as string | undefined
      if (directPath) return directPath
      const resolvedPath = api.file.getPathForFile(file as any)
      return resolvedPath || undefined
    })
    .filter((path): path is string => Boolean(path))
}
