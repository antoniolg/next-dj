export const PERFORMANCE_TRACE_STORAGE_KEY = 'nextdj.perf'

let measurementId = 0

function hasPerformanceApi(): boolean {
  return typeof performance !== 'undefined' && typeof performance.mark === 'function'
}

export function isPerformanceTracingEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(PERFORMANCE_TRACE_STORAGE_KEY) === '1') {
      return true
    }

    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('nextdjPerf') === '1'
    }
  } catch {
    return false
  }

  return false
}

function finishMeasurement(name: string, startMark: string, endMark: string): void {
  performance.mark(endMark)
  performance.measure(`nextdj.${name}`, startMark, endMark)

  if (isPerformanceTracingEnabled()) {
    const entries = performance.getEntriesByName(`nextdj.${name}`)
    const latestEntry = entries[entries.length - 1]

    if (latestEntry) {
      console.debug(`[nextdj:perf] ${name}: ${latestEntry.duration.toFixed(1)}ms`)
    }
  }

  performance.clearMarks(startMark)
  performance.clearMarks(endMark)
}

export function measureSync<T>(name: string, operation: () => T): T {
  if (!hasPerformanceApi()) {
    return operation()
  }

  measurementId += 1
  const startMark = `nextdj.${name}.${measurementId}.start`
  const endMark = `nextdj.${name}.${measurementId}.end`

  performance.mark(startMark)

  try {
    return operation()
  } finally {
    finishMeasurement(name, startMark, endMark)
  }
}

export async function measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
  if (!hasPerformanceApi()) {
    return operation()
  }

  measurementId += 1
  const startMark = `nextdj.${name}.${measurementId}.start`
  const endMark = `nextdj.${name}.${measurementId}.end`

  performance.mark(startMark)

  try {
    return await operation()
  } finally {
    finishMeasurement(name, startMark, endMark)
  }
}
