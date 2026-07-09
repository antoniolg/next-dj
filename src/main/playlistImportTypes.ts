import type {
  PlaylistImportProviderSummary,
  PlaylistImportResolvedFile,
  PlaylistImportTrack
} from '../shared/nextdj.js'

export interface PlaylistImportProvider {
  id: string
  displayName: string
  canHandle?: (input: string) => boolean | Promise<boolean>
  listTracks: (input: string) => Promise<Array<Omit<PlaylistImportTrack, 'providerId'>>>
  resolveTrack: (externalRef: string) => Promise<PlaylistImportResolvedFile>
}

export type PlaylistImportPluginExport =
  | PlaylistImportProvider
  | PlaylistImportProvider[]
  | {
      provider?: PlaylistImportProvider
      providers?: PlaylistImportProvider[]
      default?: PlaylistImportProvider | PlaylistImportProvider[]
    }

export interface PlaylistImportRegistry {
  listProviders: () => PlaylistImportProviderSummary[]
  listTracks: (input: string) => Promise<PlaylistImportTrack[]>
  resolveTrack: (providerId: string, externalRef: string) => Promise<PlaylistImportResolvedFile>
}
