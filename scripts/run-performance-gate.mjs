/* global clearTimeout, process, setTimeout */
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluatePerformanceSnapshots, PERFORMANCE_BUDGETS } from './lib/performance-budget.mjs'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function readOption(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

function readNonNegativeInteger(name, fallback) {
  const value = Number(readOption(name, String(fallback)))

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`)
  }

  return value
}

function runCapture(args, timeoutMs) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [join(PROJECT_ROOT, 'scripts/capture-renderer-perf.mjs'), ...args], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'ignore', 'inherit']
    })
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      rejectRun(new Error(`Performance capture exceeded ${timeoutMs}ms.`))
    }, timeoutMs)

    child.once('error', (error) => {
      clearTimeout(timeout)
      rejectRun(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)

      if (code === 0) {
        resolveRun()
      } else {
        rejectRun(new Error(`Performance capture failed with ${signal ?? `exit code ${code}`}.`))
      }
    })
  })
}

const scenario = readOption('--scenario', 'deck-load')
const repetitions = readNonNegativeInteger('--repetitions', 3)
const warmupMs = readNonNegativeInteger('--warmup-ms', 1000)
const waitMs = readNonNegativeInteger('--wait-ms', 500)
const timeoutMs = readNonNegativeInteger('--timeout-ms', 45000)
const outputPath = readOption('--out', '')

if (!(scenario in PERFORMANCE_BUDGETS)) {
  throw new Error(`--scenario must be one of: ${Object.keys(PERFORMANCE_BUDGETS).join(', ')}`)
}

if (repetitions < 1) {
  throw new Error('--repetitions must be at least 1.')
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'nextdj-performance-gate-'))
const snapshots = []

try {
  for (let index = 0; index < repetitions; index += 1) {
    const capturePath = join(temporaryDirectory, `run-${index + 1}.json`)
    await runCapture(
      [
        '--scenario',
        scenario,
        '--warmup-ms',
        String(warmupMs),
        '--wait-ms',
        String(waitMs),
        '--out',
        capturePath
      ],
      timeoutMs
    )
    snapshots.push(JSON.parse(await readFile(capturePath, 'utf8')))
  }

  const violations = evaluatePerformanceSnapshots(scenario, snapshots)
  const report = {
    scenario,
    repetitions,
    warmupMs,
    waitMs,
    budget: PERFORMANCE_BUDGETS[scenario],
    passed: violations.length === 0,
    violations,
    snapshots
  }
  const serializedReport = `${JSON.stringify(report, null, 2)}\n`

  if (outputPath) {
    const absoluteOutputPath = resolve(PROJECT_ROOT, outputPath)
    await mkdir(dirname(absoluteOutputPath), { recursive: true })
    await writeFile(absoluteOutputPath, serializedReport)
  }

  process.stdout.write(serializedReport)

  if (violations.length > 0) {
    process.exitCode = 1
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true })
}
