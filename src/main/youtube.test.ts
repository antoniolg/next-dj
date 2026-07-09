import { describe, expect, it } from 'vitest'
import {
  createYouTubeWatchUrl,
  getAudioExtension,
  isYouTubeUrl,
  mapYouTubeInfo,
  parseDownloadedFilePaths
} from './youtube.js'

describe('youtube service helpers', () => {
  it('accepts supported YouTube hosts only', () => {
    expect(isYouTubeUrl('https://music.youtube.com/watch?v=abcdefghijk')).toBe(true)
    expect(isYouTubeUrl('https://youtu.be/abcdefghijk')).toBe(true)
    expect(isYouTubeUrl('https://example.com/watch?v=abcdefghijk')).toBe(false)
  })

  it('maps yt-dlp video ids into watch URLs', () => {
    expect(createYouTubeWatchUrl({ url: 'abcdefghijk' })).toBe('https://www.youtube.com/watch?v=abcdefghijk')
  })

  it('maps yt-dlp metadata into track summaries', () => {
    expect(mapYouTubeInfo({ id: 'abc', title: 'Track', duration: 12, webpage_url: 'https://youtu.be/abc' }, 0)).toEqual({
      id: 'abc',
      title: 'Track',
      duration: 12,
      url: 'https://youtu.be/abc'
    })
  })

  it('extracts audio paths from yt-dlp output', () => {
    expect(getAudioExtension('track.FLAC')).toBe('.flac')
    expect(parseDownloadedFilePaths('noise\n/tmp/track.mp3\n/tmp/not-video.txt\n')).toEqual(['/tmp/track.mp3'])
  })
})
