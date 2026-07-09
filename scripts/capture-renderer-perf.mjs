/* global WebSocket, fetch, process, setTimeout */
import { spawn } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const DEFAULT_WAIT_MS = 5000
const SCENARIOS = new Set(['', 'deck-load'])

function readOption(name, fallback) {
  const index = process.argv.indexOf(name)

  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJson(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Could not read ${url}: ${response.status}`)
  }

  return response.json()
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (address && typeof address === 'object') {
          resolve(address.port)
        } else {
          reject(new Error('Could not allocate a local debugging port.'))
        }
      })
    })
  })
}

async function findRendererTarget(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  const url = `http://127.0.0.1:${port}/json/list`

  while (Date.now() < deadline) {
    try {
      const targets = await readJson(url)
      const target = targets.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl)

      if (target) {
        return target
      }
    } catch {
      // Electron may still be starting.
    }

    await delay(250)
  }

  throw new Error(`No Electron renderer target appeared on port ${port}.`)
}

function createCdpClient(webSocketDebuggerUrl) {
  let nextId = 1
  const pending = new Map()
  const socket = new WebSocket(webSocketDebuggerUrl)

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data.toString())

    if (!message.id) {
      return
    }

    const request = pending.get(message.id)

    if (!request) {
      return
    }

    pending.delete(message.id)

    if (message.error) {
      request.reject(new Error(message.error.message ?? 'CDP command failed.'))
    } else {
      request.resolve(message.result)
    }
  })

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve({
        close: () => socket.close(),
        send: (method, params = {}) =>
          new Promise((requestResolve, requestReject) => {
            const id = nextId
            nextId += 1
            pending.set(id, { resolve: requestResolve, reject: requestReject })
            socket.send(JSON.stringify({ id, method, params }))
          })
      })
    })
    socket.addEventListener('error', () => reject(new Error('Could not connect to Electron renderer CDP.')))
  })
}

async function waitForProfiler(client, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const result = await client.send('Runtime.evaluate', {
      expression: 'Boolean(globalThis.__NEXTDJ_PERF__?.snapshot)',
      returnByValue: true
    })

    if (result.result?.value === true) {
      return
    }

    await delay(250)
  }

  throw new Error('Renderer profiler did not become available.')
}

async function readSnapshot(client) {
  const result = await client.send('Runtime.evaluate', {
    expression: 'globalThis.__NEXTDJ_PERF__.snapshot()',
    returnByValue: true
  })

  return result.result?.value
}

function hasMeasure(snapshot, name) {
  return Boolean(snapshot?.measures?.[name]?.count)
}

async function waitForMeasures(client, names, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const snapshot = await readSnapshot(client)

    if (names.every((name) => hasMeasure(snapshot, name))) {
      return
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for performance measures: ${names.join(', ')}`)
}

async function waitForSelectorNode(client, selector, timeoutMs) {
  const deadline = Date.now() + timeoutMs

  await client.send('DOM.enable')

  while (Date.now() < deadline) {
    const documentResult = await client.send('DOM.getDocument', { depth: -1, pierce: true })
    const queryResult = await client.send('DOM.querySelectorAll', {
      nodeId: documentResult.root.nodeId,
      selector
    })
    const [nodeId] = queryResult.nodeIds ?? []

    if (nodeId) {
      return nodeId
    }

    await delay(250)
  }

  throw new Error(`Could not find selector: ${selector}`)
}

function createSyntheticWavBuffer({ durationSeconds = 2, frequencyHz = 440, sampleRate = 44100 } = {}) {
  const channelCount = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const sampleCount = Math.floor(durationSeconds * sampleRate)
  const dataSize = sampleCount * channelCount * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channelCount, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28)
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate)
    buffer.writeInt16LE(Math.round(sample * 0x4fff), 44 + index * bytesPerSample)
  }

  return buffer
}

async function createSyntheticAudioFile() {
  const directory = await mkdtemp(join(tmpdir(), 'nextdj-perf-'))
  const filePath = join(directory, 'synthetic-track.wav')

  await writeFile(filePath, createSyntheticWavBuffer())

  return {
    filePath,
    remove: () => rm(directory, { force: true, recursive: true })
  }
}

async function loadSyntheticDeckTrack(client) {
  const fixture = await createSyntheticAudioFile()

  try {
    const nodeId = await waitForSelectorNode(client, '.deck-panel input[type="file"]', 10000)

    await client.send('DOM.setFileInputFiles', {
      files: [fixture.filePath],
      nodeId
    })
    await waitForMeasures(
      client,
      [
        'library.audioMetadata.decodeAudioData',
        'library.audioMetadata.detectBpm',
        'deck.loadFile.decodeAudioData',
        'deck.loadFile.computeWaveform'
      ],
      20000
    )
  } finally {
    await fixture.remove()
  }
}

async function runScenario(client, scenario) {
  if (scenario === 'deck-load') {
    return loadSyntheticDeckTrack(client)
  }

  return null
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }

  const signalProcessGroup = (signal) => {
    try {
      process.kill(-child.pid, signal)
    } catch {
      child.kill(signal)
    }
  }

  signalProcessGroup('SIGINT')

  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(2000).then(() => {
      if (child.exitCode === null && child.signalCode === null) {
        signalProcessGroup('SIGTERM')
      }
    })
  ])
}

const requestedPort = readOption('--port', '')
const port = requestedPort ? Number(requestedPort) : await getFreePort()
const waitMs = Number(readOption('--wait-ms', String(DEFAULT_WAIT_MS)))
const outPath = readOption('--out', '')
const scenario = readOption('--scenario', '')

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('--port must be an integer between 1024 and 65535.')
}

if (!Number.isInteger(waitMs) || waitMs < 0) {
  throw new Error('--wait-ms must be a positive integer.')
}

if (!SCENARIOS.has(scenario)) {
  throw new Error(`--scenario must be one of: ${Array.from(SCENARIOS).filter(Boolean).join(', ')}`)
}

const userDataDirectory = scenario ? await mkdtemp(join(tmpdir(), 'nextdj-perf-user-data-')) : ''
const child = spawn('npm', ['run', 'dev'], {
  detached: true,
  env: {
    ...process.env,
    NEXTDJ_PERF: '1',
    NEXTDJ_REMOTE_DEBUGGING_PORT: String(port),
    ...(userDataDirectory ? { NEXTDJ_PERF_USER_DATA_DIR: userDataDirectory } : {})
  },
  stdio: ['ignore', 'pipe', 'pipe']
})

child.stdout.on('data', (data) => process.stderr.write(data))
child.stderr.on('data', (data) => process.stderr.write(data))

let client

try {
  const target = await findRendererTarget(port, 15000)
  client = await createCdpClient(target.webSocketDebuggerUrl)
  await waitForProfiler(client, 10000)
  await runScenario(client, scenario)
  await delay(waitMs)

  const snapshot = await readSnapshot(client)
  const output = `${JSON.stringify(snapshot, null, 2)}\n`

  if (outPath) {
    await writeFile(outPath, output)
  } else {
    process.stdout.write(output)
  }
} finally {
  client?.close()
  await stop(child)
  if (userDataDirectory) {
    await rm(userDataDirectory, { force: true, recursive: true })
  }
}
