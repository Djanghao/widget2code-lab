import type { FileEntry } from "@/lib/file-loader"

export interface ExperimentRecord {
  run: string
  provider: string
  size: string
  id: string
  imageFile?: File
  detailedHtml?: string
  detailedRaw?: string
  minimalHtml?: string
  minimalRaw?: string
}

export interface ParseResult {
  experiments: ExperimentRecord[]
  runs: string[]
}

type ExperimentAccumulator = {
  run: string
  provider: string
  size: string
  id: string
  imageFile?: File
  detailedHtml?: Promise<string>
  detailedRaw?: Promise<string>
  minimalHtml?: Promise<string>
  minimalRaw?: Promise<string>
}

function splitPath(path: string) {
  return path.split(/\\|\//).filter((segment) => segment.length)
}

function toKey(run: string, provider: string, size: string, id: string) {
  return `${run}::${provider}::${size}::${id}`
}

function captureExperiment(map: Map<string, ExperimentAccumulator>, run: string, provider: string, size: string, id: string) {
  const key = toKey(run, provider, size, id)
  if (!map.has(key)) {
    map.set(key, { run, provider, size, id })
  }
  return map.get(key)!
}

export async function parseExperiments(entries: FileEntry[]): Promise<ParseResult> {
  const experiments = new Map<string, ExperimentAccumulator>()
  const runOrder: string[] = []
  const runSeen = new Set<string>()
  for (const entry of entries) {
    const segments = splitPath(entry.path)
    if (segments.length < 5) {
      continue
    }
    const [run, provider, size, id, ...rest] = segments
    if (!runSeen.has(run)) {
      runOrder.push(run)
      runSeen.add(run)
    }
    const experiment = captureExperiment(experiments, run, provider, size, id)
    if (!rest.length) {
      continue
    }
    const scope = rest.length === 1 ? undefined : rest[0]
    const name = rest[rest.length - 1]
    const lowerName = name.toLowerCase()
    if (!scope) {
      if (lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".webp")) {
        experiment.imageFile = entry.file
      } else if (lowerName.endsWith(".html")) {
        experiment.detailedHtml = entry.file.text()
      } else if (lowerName.endsWith(".txt")) {
        experiment.detailedRaw = entry.file.text()
      }
      continue
    }
    if (scope === "detailed") {
      if (lowerName.endsWith(".html")) {
        experiment.detailedHtml = entry.file.text()
      } else if (lowerName.endsWith(".txt")) {
        experiment.detailedRaw = entry.file.text()
      }
      continue
    }
    if (scope === "minimal") {
      if (lowerName.endsWith(".html")) {
        experiment.minimalHtml = entry.file.text()
      } else if (lowerName.endsWith(".txt")) {
        experiment.minimalRaw = entry.file.text()
      }
    }
  }
  const results: ExperimentRecord[] = []
  for (const experiment of experiments.values()) {
    const detailedHtml = experiment.detailedHtml ? await experiment.detailedHtml : undefined
    const detailedRaw = experiment.detailedRaw ? await experiment.detailedRaw : undefined
    const minimalHtml = experiment.minimalHtml ? await experiment.minimalHtml : undefined
    const minimalRaw = experiment.minimalRaw ? await experiment.minimalRaw : undefined
    results.push({
      run: experiment.run,
      provider: experiment.provider,
      size: experiment.size,
      id: experiment.id,
      imageFile: experiment.imageFile,
      detailedHtml,
      detailedRaw,
      minimalHtml,
      minimalRaw,
    })
  }
  results.sort((a, b) => {
    if (a.run !== b.run) {
      return runOrder.indexOf(a.run) - runOrder.indexOf(b.run)
    }
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider)
    }
    if (a.size !== b.size) {
      return a.size.localeCompare(b.size)
    }
    if (a.id !== b.id) {
      return a.id.localeCompare(b.id)
    }
    return 0
  })
  return { experiments: results, runs: runOrder }
}
