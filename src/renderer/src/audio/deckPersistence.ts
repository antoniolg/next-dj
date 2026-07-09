import type { HotCue } from './deck'

const HOT_CUE_STORAGE_KEY = 'nextdj.hotCues'
const CUE_POINT_STORAGE_KEY = 'nextdj.cuePoints'
const HOT_CUE_COLORS = ['#22d3ee', '#f97316', '#a78bfa', '#22c55e'] as const

export function loadHotCues(trackName: string, clampPosition: (seconds: number) => number): Array<HotCue | null> {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOT_CUE_STORAGE_KEY) ?? '{}') as Record<
      string,
      Array<HotCue | null>
    >
    const stored = parsed[trackName]

    if (!Array.isArray(stored)) {
      return [null, null, null, null]
    }

    return HOT_CUE_COLORS.map((color, index) => {
      const cue = stored[index]

      if (!cue || typeof cue.position !== 'number') {
        return null
      }

      return {
        position: clampPosition(cue.position),
        color: typeof cue.color === 'string' ? cue.color : color
      }
    })
  } catch {
    return [null, null, null, null]
  }
}

export function saveHotCues(trackName: string, hotCues: Array<HotCue | null>): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOT_CUE_STORAGE_KEY) ?? '{}') as Record<
      string,
      Array<HotCue | null>
    >

    parsed[trackName] = hotCues
    localStorage.setItem(HOT_CUE_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    localStorage.setItem(HOT_CUE_STORAGE_KEY, JSON.stringify({ [trackName]: hotCues }))
  }
}

export function loadCuePoint(trackName: string, clampPosition: (seconds: number) => number): number {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUE_POINT_STORAGE_KEY) ?? '{}') as Record<string, number>
    const cuePoint = parsed[trackName]

    return typeof cuePoint === 'number' ? clampPosition(cuePoint) : 0
  } catch {
    return 0
  }
}

export function saveCuePoint(trackName: string, cuePoint: number): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUE_POINT_STORAGE_KEY) ?? '{}') as Record<string, number>
    parsed[trackName] = cuePoint
    localStorage.setItem(CUE_POINT_STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    localStorage.setItem(CUE_POINT_STORAGE_KEY, JSON.stringify({ [trackName]: cuePoint }))
  }
}
