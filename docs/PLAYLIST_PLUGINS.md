# Playlist Import Plugins

NextDJ can load external playlist import providers from a local config file. Providers run in the Electron main process and are never executed in the renderer.

## Local Config

Create `playlist-plugins.json` in the app user data directory:

```json
{
  "plugins": [
    "/absolute/path/to/demo-playlist-plugin/dist/index.mjs"
  ]
}
```

Relative paths are resolved from the directory that contains `playlist-plugins.json`.

## Provider API

A plugin is an ESM module that exports one provider, a default provider, or a `providers` array:

```ts
export interface PlaylistImportProvider {
  id: string
  displayName: string
  canHandle?: (input: string) => boolean | Promise<boolean>
  listTracks: (input: string) => Promise<Array<{
    id: string
    title: string
    duration: number
    externalRef: string
  }>>
  resolveTrack: (externalRef: string) => Promise<{
    file: {
      data: ArrayBuffer
      name: string
      lastModified: number
      type?: string
    } | null
    outputDirectory: string
  }>
}
```

Provider ids must be stable and match `^[a-z0-9][a-z0-9._-]*$`.

## Demo Provider

```js
export default {
  id: 'demo-local',
  displayName: 'Demo Local',
  canHandle: (input) => input.startsWith('demo:'),
  async listTracks() {
    return [
      {
        id: 'demo-track',
        title: 'Demo Playlist Track',
        duration: 30,
        externalRef: 'demo-track'
      }
    ]
  },
  async resolveTrack() {
    return {
      file: null,
      outputDirectory: ''
    }
  }
}
```

Providers are responsible for only importing content that the user has the right to access, copy, and use.
