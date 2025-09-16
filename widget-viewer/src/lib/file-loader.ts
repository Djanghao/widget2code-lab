export interface FileEntry {
  file: File
  path: string
}

function normalizePath(path: string) {
  return path.replace(/^\//, "")
}

async function traverseEntry(entry: any, parentPath = ""): Promise<FileEntry[]> {
  if (!entry) {
    return []
  }
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file(
        (file: File) => {
          const fullPath = normalizePath(parentPath ? `${parentPath}/${file.name}` : file.name)
          resolve([{ file, path: fullPath }])
        },
        (error: Error) => reject(error)
      )
    })
  }
  if (entry.isDirectory) {
    const directoryPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
    const reader = entry.createReader()
    const files: FileEntry[] = []
    while (true) {
      const batch: any[] = await new Promise((resolve, reject) => {
        reader.readEntries(resolve, reject)
      })
      if (!batch.length) {
        break
      }
      for (const child of batch) {
        const childEntries = await traverseEntry(child, directoryPath)
        files.push(...childEntries)
      }
    }
    return files
  }
  return []
}

export async function extractDataTransferFiles(dataTransfer: DataTransfer | null): Promise<FileEntry[]> {
  if (!dataTransfer) {
    return []
  }
  const items = Array.from(dataTransfer.items || [])
  const entries: FileEntry[] = []
  for (const item of items) {
    const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null
    if (entry) {
      const entryFiles = await traverseEntry(entry)
      entries.push(...entryFiles)
    } else {
      const file = item.getAsFile()
      if (file) {
        entries.push({ file, path: normalizePath(file.name) })
      }
    }
  }
  if (!entries.length) {
    const fallbackFiles = Array.from(dataTransfer.files || [])
    for (const file of fallbackFiles) {
      const relative = (file as any).webkitRelativePath
      entries.push({ file, path: normalizePath(relative || file.name) })
    }
  }
  return entries
}

export function entriesFromFileList(list: FileList | null): FileEntry[] {
  if (!list) {
    return []
  }
  return Array.from(list).map((file) => {
    const relative = (file as any).webkitRelativePath
    return {
      file,
      path: normalizePath(relative || file.name),
    }
  })
}
