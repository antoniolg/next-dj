import { useCallback, useEffect, useRef, useState } from 'react'
import type { EqBand } from '../audio/deck'
import { getEngine, type DJEngine } from '../audio/engine'
import type { OutputDeviceInfo } from '../audio/output'

export type DeckId = 'A' | 'B'

interface DeckState {
  trackName: string
  duration: number
  position: number
  isPlaying: boolean
  pitch: number
}

interface ChannelState {
  trim: number
  eq: Record<EqBand, number>
  volume: number
  cue: boolean
}

interface MixerState {
  crossfade: number
  cueMix: number
  masterVolume: number
}

interface OutputState {
  devices: OutputDeviceInfo[]
  masterDeviceId: string
  cueDeviceId: string
  error: string | null
}

const MASTER_OUTPUT_STORAGE_KEY = 'nextdj.masterOutputDeviceId'
const CUE_OUTPUT_STORAGE_KEY = 'nextdj.cueOutputDeviceId'

const createDeckState = (): DeckState => ({
  trackName: 'No track loaded',
  duration: 0,
  position: 0,
  isPlaying: false,
  pitch: 0
})

const createChannelState = (): ChannelState => ({
  trim: 1,
  eq: { high: 0, mid: 0, low: 0 },
  volume: 1,
  cue: false
})

export function useEngine(): {
  engine: DJEngine
  decks: Record<DeckId, DeckState>
  channels: Record<DeckId, ChannelState>
  mixer: MixerState
  output: OutputState
  loadTrack: (deckId: DeckId, file: File) => Promise<void>
  togglePlayback: (deckId: DeckId) => Promise<void>
  seek: (deckId: DeckId, seconds: number) => void
  cueToStart: (deckId: DeckId) => void
  setPitch: (deckId: DeckId, percent: number) => void
  setTrim: (deckId: DeckId, value: number) => void
  setEq: (deckId: DeckId, band: EqBand, value: number) => void
  setChannelVolume: (deckId: DeckId, value: number) => void
  toggleCue: (deckId: DeckId) => void
  setCrossfade: (value: number) => void
  setCueMix: (value: number) => void
  setMasterVolume: (value: number) => void
  setMasterDevice: (deviceId: string) => void
  setCueDevice: (deviceId: string) => void
  refreshOutputDevices: () => Promise<void>
} {
  const engineRef = useRef<DJEngine | null>(null)
  const [decks, setDecks] = useState<Record<DeckId, DeckState>>({
    A: createDeckState(),
    B: createDeckState()
  })
  const [channels, setChannels] = useState<Record<DeckId, ChannelState>>({
    A: createChannelState(),
    B: createChannelState()
  })
  const [mixer, setMixer] = useState<MixerState>({
    crossfade: 0,
    cueMix: 0,
    masterVolume: 0.9
  })
  const [output, setOutput] = useState<OutputState>({
    devices: [],
    masterDeviceId: 'default',
    cueDeviceId: 'default',
    error: null
  })

  if (!engineRef.current) {
    engineRef.current = getEngine()
  }

  const engine = engineRef.current

  const getDeck = useCallback(
    (deckId: DeckId) => (deckId === 'A' ? engine.deckA : engine.deckB),
    [engine]
  )

  useEffect(() => {
    engine.deckA.onEnded = () => {
      setDecks((current) => ({ ...current, A: { ...current.A, isPlaying: false } }))
    }
    engine.deckB.onEnded = () => {
      setDecks((current) => ({ ...current, B: { ...current.B, isPlaying: false } }))
    }

    return () => {
      engine.deckA.onEnded = null
      engine.deckB.onEnded = null
    }
  }, [engine])

  useEffect(() => {
    let frameId = 0

    const tick = (): void => {
      setDecks((current) => ({
        A: {
          ...current.A,
          position: engine.deckA.getPosition(),
          isPlaying: engine.deckA.isPlaying
        },
        B: {
          ...current.B,
          position: engine.deckB.getPosition(),
          isPlaying: engine.deckB.isPlaying
        }
      }))
      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [engine])

  const refreshOutputDevices = useCallback(async (): Promise<void> => {
    try {
      const devices = await engine.outputRouter.listOutputDevices()
      setOutput((current) => ({ ...current, devices, error: null }))
    } catch (error) {
      setOutput((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Could not list audio outputs.'
      }))
    }
  }, [engine])

  useEffect(() => {
    const masterDeviceId = localStorage.getItem(MASTER_OUTPUT_STORAGE_KEY) ?? 'default'
    const cueDeviceId = localStorage.getItem(CUE_OUTPUT_STORAGE_KEY) ?? 'default'

    setOutput((current) => ({ ...current, masterDeviceId, cueDeviceId }))

    void engine.outputRouter.setMasterDevice(masterDeviceId).catch((error: unknown) => {
      setOutput((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Could not set master output.'
      }))
    })
    void engine.outputRouter.setCueDevice(cueDeviceId).catch((error: unknown) => {
      setOutput((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Could not set headphones output.'
      }))
    })
    void refreshOutputDevices()
  }, [engine, refreshOutputDevices])

  const loadTrack = useCallback(
    async (deckId: DeckId, file: File): Promise<void> => {
      const deck = getDeck(deckId)
      await deck.loadFile(file)
      setDecks((current) => ({
        ...current,
        [deckId]: {
          ...current[deckId],
          trackName: deck.metadata.name,
          duration: deck.duration,
          position: 0,
          isPlaying: false
        }
      }))
    },
    [getDeck]
  )

  const togglePlayback = useCallback(
    async (deckId: DeckId): Promise<void> => {
      const deck = getDeck(deckId)

      if (deck.isPlaying) {
        deck.pause()
      } else {
        await deck.play()
      }

      setDecks((current) => ({
        ...current,
        [deckId]: { ...current[deckId], isPlaying: deck.isPlaying, position: deck.getPosition() }
      }))
    },
    [getDeck]
  )

  const seek = useCallback(
    (deckId: DeckId, seconds: number): void => {
      const deck = getDeck(deckId)
      deck.seek(seconds)
      setDecks((current) => ({
        ...current,
        [deckId]: { ...current[deckId], position: deck.getPosition() }
      }))
    },
    [getDeck]
  )

  const cueToStart = useCallback(
    (deckId: DeckId): void => {
      seek(deckId, 0)
    },
    [seek]
  )

  const setPitch = useCallback(
    (deckId: DeckId, percent: number): void => {
      getDeck(deckId).setPitch(percent)
      setDecks((current) => ({ ...current, [deckId]: { ...current[deckId], pitch: percent } }))
    },
    [getDeck]
  )

  const setTrim = useCallback(
    (deckId: DeckId, value: number): void => {
      getDeck(deckId).setTrim(value)
      setChannels((current) => ({ ...current, [deckId]: { ...current[deckId], trim: value } }))
    },
    [getDeck]
  )

  const setEq = useCallback(
    (deckId: DeckId, band: EqBand, value: number): void => {
      getDeck(deckId).setEq(band, value)
      setChannels((current) => ({
        ...current,
        [deckId]: {
          ...current[deckId],
          eq: { ...current[deckId].eq, [band]: value }
        }
      }))
    },
    [getDeck]
  )

  const setChannelVolume = useCallback(
    (deckId: DeckId, value: number): void => {
      getDeck(deckId).setChannelFader(value)
      setChannels((current) => ({ ...current, [deckId]: { ...current[deckId], volume: value } }))
    },
    [getDeck]
  )

  const toggleCue = useCallback(
    (deckId: DeckId): void => {
      setChannels((current) => {
        const nextCue = !current[deckId].cue
        engine.mixer.setCue(deckId, nextCue)
        return { ...current, [deckId]: { ...current[deckId], cue: nextCue } }
      })
    },
    [engine]
  )

  const setCrossfade = useCallback(
    (value: number): void => {
      engine.mixer.setCrossfade(value)
      setMixer((current) => ({ ...current, crossfade: value }))
    },
    [engine]
  )

  const setCueMix = useCallback(
    (value: number): void => {
      engine.mixer.setCueMix(value)
      setMixer((current) => ({ ...current, cueMix: value }))
    },
    [engine]
  )

  const setMasterVolume = useCallback(
    (value: number): void => {
      engine.mixer.setMasterGain(value)
      setMixer((current) => ({ ...current, masterVolume: value }))
    },
    [engine]
  )

  const setMasterDevice = useCallback(
    (deviceId: string): void => {
      setOutput((current) => ({ ...current, masterDeviceId: deviceId }))
      localStorage.setItem(MASTER_OUTPUT_STORAGE_KEY, deviceId)
      void engine.outputRouter
        .setMasterDevice(deviceId)
        .then(() => setOutput((current) => ({ ...current, error: null })))
        .catch((error: unknown) => {
          setOutput((current) => ({
            ...current,
            error: error instanceof Error ? error.message : 'Could not set master output.'
          }))
        })
    },
    [engine]
  )

  const setCueDevice = useCallback(
    (deviceId: string): void => {
      setOutput((current) => ({ ...current, cueDeviceId: deviceId }))
      localStorage.setItem(CUE_OUTPUT_STORAGE_KEY, deviceId)
      void engine.outputRouter
        .setCueDevice(deviceId)
        .then(() => setOutput((current) => ({ ...current, error: null })))
        .catch((error: unknown) => {
          setOutput((current) => ({
            ...current,
            error: error instanceof Error ? error.message : 'Could not set headphones output.'
          }))
        })
    },
    [engine]
  )

  return {
    engine,
    decks,
    channels,
    mixer,
    output,
    loadTrack,
    togglePlayback,
    seek,
    cueToStart,
    setPitch,
    setTrim,
    setEq,
    setChannelVolume,
    toggleCue,
    setCrossfade,
    setCueMix,
    setMasterVolume,
    setMasterDevice,
    setCueDevice,
    refreshOutputDevices
  }
}
