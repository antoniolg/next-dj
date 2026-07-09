import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  createPlaylistImportRegistry,
  loadPlaylistImportProviders,
  readPlaylistPluginPaths
} from './playlistImport.js'
import { createDemoPlaylistProvider } from './demoPlaylistProvider.js'

describe('playlist import registry', () => {
  it('returns no plugin paths when config is missing or empty', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'nextdj-playlist-import-'))
    const configPath = join(tempDir, 'playlist-plugins.json')

    await expect(readPlaylistPluginPaths(configPath)).resolves.toEqual([])

    await writeFile(configPath, JSON.stringify({ plugins: [] }))
    await expect(readPlaylistPluginPaths(configPath)).resolves.toEqual([])
  })

  it('resolves relative plugin paths from the config directory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'nextdj-playlist-import-'))
    const configPath = join(tempDir, 'playlist-plugins.json')

    await writeFile(configPath, JSON.stringify({ plugins: ['./plugins/demo.mjs'] }))

    await expect(readPlaylistPluginPaths(configPath)).resolves.toEqual([join(tempDir, 'plugins/demo.mjs')])
  })

  it('loads providers from ESM plugins', async () => {
    const pluginPath = `data:text/javascript,${encodeURIComponent(`
        export default {
          id: 'fixture',
          displayName: 'Fixture Provider',
          canHandle: (input) => input.startsWith('fixture:'),
          listTracks: async () => [{ id: 'one', title: 'One', duration: 1, externalRef: 'one' }],
          resolveTrack: async () => ({ file: null, outputDirectory: '' })
        }
      `)}`

    const providers = await loadPlaylistImportProviders([pluginPath])

    expect(providers).toHaveLength(1)
    expect(providers[0].id).toBe('fixture')
  })

  it('lists tracks through the first provider that can handle the input', async () => {
    const registry = createPlaylistImportRegistry([createDemoPlaylistProvider()])

    await expect(registry.listTracks('demo:playlist')).resolves.toEqual([
      {
        providerId: 'demo-local',
        id: 'demo-track',
        title: 'Demo Playlist Track',
        duration: 30,
        externalRef: 'demo-track'
      }
    ])
  })

  it('rejects unknown providers and duplicate provider ids', async () => {
    const provider = createDemoPlaylistProvider()
    const registry = createPlaylistImportRegistry([provider])

    await expect(registry.resolveTrack('missing', 'track')).rejects.toThrow('Unknown playlist import provider.')
    expect(() => createPlaylistImportRegistry([provider, provider])).toThrow('Duplicate playlist import provider id')
  })
})
