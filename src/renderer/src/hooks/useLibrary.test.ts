import { describe, expect, it } from 'vitest'
import { createPlaylistFileName } from './useLibrary'

describe('createPlaylistFileName', () => {
  it('uses the playlist title instead of the yt-dlp cache name', () => {
    expect(createPlaylistFileName('PokyFair (Poky Mix)', '-PokyFair_Poky_Mix-HW1i2qNqB-w.mp3')).toBe(
      'PokyFair (Poky Mix).mp3'
    )
  })

  it('keeps the downloaded audio extension', () => {
    expect(createPlaylistFileName('Backspipa (HardhouseClique Remix)', '002-Backspipa-abc123.opus')).toBe(
      'Backspipa (HardhouseClique Remix).opus'
    )
  })

  it('removes path-hostile characters from playlist titles', () => {
    expect(createPlaylistFileName('Track / Remix: Final?', 'download.mp3')).toBe('Track Remix Final.mp3')
  })
})
