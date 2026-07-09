import { app, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { PlaylistImportResolvedFile, PlaylistImportTrack } from '../shared/nextdj.js'
import type {
  PlaylistImportPluginExport,
  PlaylistImportProvider,
  PlaylistImportRegistry
} from './playlistImportTypes.js'

const CONFIG_FILE_NAME = 'playlist-plugins.json'

interface PlaylistPluginConfig {
  plugins?: unknown
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function validateProvider(provider: PlaylistImportProvider): void {
  if (!provider.id || !/^[a-z0-9][a-z0-9._-]*$/i.test(provider.id)) {
    throw new Error('Playlist import provider has an invalid id.')
  }

  if (!provider.displayName) {
    throw new Error(`Playlist import provider "${provider.id}" has no display name.`)
  }

  if (typeof provider.listTracks !== 'function' || typeof provider.resolveTrack !== 'function') {
    throw new Error(`Playlist import provider "${provider.id}" is missing required methods.`)
  }
}

function normalizePluginExport(pluginExport: PlaylistImportPluginExport): PlaylistImportProvider[] {
  if (Array.isArray(pluginExport)) {
    return pluginExport
  }

  if ('providers' in pluginExport && Array.isArray(pluginExport.providers)) {
    return pluginExport.providers
  }

  if ('provider' in pluginExport && pluginExport.provider) {
    return [pluginExport.provider]
  }

  if ('default' in pluginExport && pluginExport.default) {
    return normalizePluginExport(pluginExport.default)
  }

  return [pluginExport as PlaylistImportProvider]
}

function resolvePluginPath(configPath: string, pluginPath: string): string {
  if (pluginPath.startsWith('data:') || pluginPath.startsWith('file:')) {
    return pluginPath
  }

  if (isAbsolute(pluginPath)) {
    return pluginPath
  }

  return resolve(configPath, '..', pluginPath)
}

function getPluginImportSpecifier(pluginPath: string): string {
  return pluginPath.startsWith('data:') || pluginPath.startsWith('file:') ? pluginPath : pathToFileURL(pluginPath).href
}

export function getPlaylistPluginConfigPath(): string {
  return resolve(app.getPath('userData'), CONFIG_FILE_NAME)
}

export async function readPlaylistPluginPaths(configPath = getPlaylistPluginConfigPath()): Promise<string[]> {
  try {
    const rawConfig = await readFile(configPath, 'utf8')
    const parsed = JSON.parse(rawConfig) as PlaylistPluginConfig

    if (!Array.isArray(parsed.plugins)) {
      return []
    }

    return parsed.plugins.map(readString).filter(Boolean).map((pluginPath) => resolvePluginPath(configPath, pluginPath))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

export async function loadPlaylistImportProviders(pluginPaths: string[]): Promise<PlaylistImportProvider[]> {
  const providers: PlaylistImportProvider[] = []

  for (const pluginPath of pluginPaths) {
    const pluginModule = (await import(/* @vite-ignore */ getPluginImportSpecifier(pluginPath))) as PlaylistImportPluginExport
    const pluginProviders = normalizePluginExport(pluginModule)

    for (const provider of pluginProviders) {
      validateProvider(provider)
      providers.push(provider)
    }
  }

  return providers
}

export function createPlaylistImportRegistry(providers: PlaylistImportProvider[]): PlaylistImportRegistry {
  const providersById = new Map<string, PlaylistImportProvider>()

  for (const provider of providers) {
    if (providersById.has(provider.id)) {
      throw new Error(`Duplicate playlist import provider id "${provider.id}".`)
    }

    providersById.set(provider.id, provider)
  }

  return {
    listProviders: () =>
      providers.map((provider) => ({
        id: provider.id,
        displayName: provider.displayName
      })),

    async listTracks(input: string): Promise<PlaylistImportTrack[]> {
      const trimmedInput = input.trim()

      if (!trimmedInput) {
        throw new Error('Paste a playlist URL or reference.')
      }

      for (const provider of providers) {
        const canHandle = provider.canHandle ? await provider.canHandle(trimmedInput) : true

        if (!canHandle) {
          continue
        }

        const tracks = await provider.listTracks(trimmedInput)
        return tracks.map((track) => ({
          ...track,
          providerId: provider.id
        }))
      }

      throw new Error('No playlist import plugin can handle this input.')
    },

    async resolveTrack(providerId: string, externalRef: string): Promise<PlaylistImportResolvedFile> {
      const provider = providersById.get(providerId)

      if (!provider) {
        throw new Error('Unknown playlist import provider.')
      }

      const trimmedRef = externalRef.trim()

      if (!trimmedRef) {
        throw new Error('Invalid playlist track reference.')
      }

      return provider.resolveTrack(trimmedRef)
    }
  }
}

export async function createConfiguredPlaylistImportRegistry(): Promise<PlaylistImportRegistry> {
  const pluginPaths = await readPlaylistPluginPaths()
  const providers = await loadPlaylistImportProviders(pluginPaths)
  return createPlaylistImportRegistry(providers)
}

export function registerPlaylistImportIpc(registryPromise = createConfiguredPlaylistImportRegistry()): void {
  ipcMain.handle('playlist-import:list-providers', async () => {
    const registry = await registryPromise
    return registry.listProviders()
  })

  ipcMain.handle('playlist-import:list-tracks', async (_event, input: unknown) => {
    if (typeof input !== 'string') {
      throw new Error('Paste a playlist URL or reference.')
    }

    const registry = await registryPromise
    return registry.listTracks(input)
  })

  ipcMain.handle('playlist-import:resolve-track', async (_event, providerId: unknown, externalRef: unknown) => {
    if (typeof providerId !== 'string' || typeof externalRef !== 'string') {
      throw new Error('Invalid playlist track reference.')
    }

    const registry = await registryPromise
    return registry.resolveTrack(providerId, externalRef)
  })
}
