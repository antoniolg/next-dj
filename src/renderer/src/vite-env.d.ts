import type { NextDjBridge, YouTubeTrackSummary as SharedYouTubeTrackSummary } from '../../shared/nextdj'

declare global {
  interface Window {
    nextdj?: NextDjBridge
  }

  type YouTubeTrackSummary = SharedYouTubeTrackSummary
}

export {}
