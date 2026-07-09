/* global WebSocket, fetch, process, setTimeout */
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'

const DEFAULT_WAIT_MS = 5000

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

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('--port must be an integer between 1024 and 65535.')
}

if (!Number.isInteger(waitMs) || waitMs < 0) {
  throw new Error('--wait-ms must be a positive integer.')
}

const child = spawn('npm', ['run', 'dev'], {
  detached: true,
  env: {
    ...process.env,
    NEXTDJ_PERF: '1',
    NEXTDJ_REMOTE_DEBUGGING_PORT: String(port)
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
}
