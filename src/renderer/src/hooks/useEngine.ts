import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MAX_PITCH_PERCENT,
  MIN_PITCH_PERCENT,
  type EqBand,
} from '../audio/deck'
import { getEngine, type DJEngine } from '../audio/engine'
import type { OutputDeviceInfo } from '../audio/output'
import { createDeckState, getDeckSnapshot, type DeckState } from './deckState'

export type DeckId = 'A' | 'B'

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
const CONTROLS_STORAGE_KEY = 'nextdj.controls.v1'

interface PersistedControls {
  channels: Record<DeckId, Pick<ChannelState, 'trim' | 'eq' | 'volume'>>
  mixer: MixerState
  deckPitch: Record<DeckId, number>
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

const createChannelState = (): ChannelState => ({
  trim: 1,
  eq: { high: 0, mid: 0, low: 0 },
  volume: 1,
  cue: false
})

const createMixerState = (): MixerState => ({
  crossfade: 0,
  cueMix: 0,
  masterVolume: 0.9
})

const DEFAULT_PITCH: Record<DeckId, number> = { A: 0, B: 0 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberFromRecord(
  value: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const nextValue = value?.[key]
  return typeof nextValue === 'number' && Number.isFinite(nextValue)
    ? clamp(nextValue, min, max)
    : fallback
}

function readPersistedControls(): PersistedControls {
  const fallbackChannels: Record<DeckId, ChannelState> = {
    A: createChannelState(),
    B: createChannelState()
  }
  const fallbackMixer = createMixerState()

  try {
    const parsed = JSON.parse(localStorage.getItem(CONTROLS_STORAGE_KEY) ?? '{}') as unknown
    const root = isRecord(parsed) ? parsed : {}
    const channelsRoot = isRecord(root.channels) ? root.channels : {}
    const mixerRoot = isRecord(root.mixer) ? root.mixer : {}
    const pitchRoot = isRecord(root.deckPitch) ? root.deckPitch : {}

    const readChannel = (deckId: DeckId): Pick<ChannelState, 'trim' | 'eq' | 'volume'> => {
      const channelRoot = isRecord(channelsRoot[deckId]) ? channelsRoot[deckId] : {}
      const eqRoot = isRecord(channelRoot.eq) ? channelRoot.eq : {}
      const fallback = fallbackChannels[deckId]

      return {
        trim: numberFromRecord(channelRoot, 'trim', fallback.trim, 0, 1.5),
        volume: numberFromRecord(channelRoot, 'volume', fallback.volume, 0, 1),
        eq: {
          high: numberFromRecord(eqRoot, 'high', fallback.eq.high, -26, 6),
          mid: numberFromRecord(eqRoot, 'mid', fallback.eq.mid, -26, 6),
          low: numberFromRecord(eqRoot, 'low', fallback.eq.low, -26, 6)
        }
      }
    }

    return {
      channels: {
        A: readChannel('A'),
        B: readChannel('B')
      },
      mixer: {
        crossfade: numberFromRecord(mixerRoot, 'crossfade', fallbackMixer.crossfade, -1, 1),
        cueMix: numberFromRecord(mixerRoot, 'cueMix', fallbackMixer.cueMix, 0, 1),
        masterVolume: numberFromRecord(mixerRoot, 'masterVolume', fallbackMixer.masterVolume, 0, 1)
      },
      deckPitch: {
        A: numberFromRecord(pitchRoot, 'A', DEFAULT_PITCH.A, MIN_PITCH_PERCENT, MAX_PITCH_PERCENT),
        B: numberFromRecord(pitchRoot, 'B', DEFAULT_PITCH.B, MIN_PITCH_PERCENT, MAX_PITCH_PERCENT)
      }
    }
  } catch {
    return {
      channels: fallbackChannels,
      mixer: fallbackMixer,
      deckPitch: DEFAULT_PITCH
    }
  }
}

function persistControls(
  channels: Record<DeckId, ChannelState>,
  mixer: MixerState,
  decks: Record<DeckId, DeckState>
): void {
  const payload: PersistedControls = {
    channels: {
      A: { trim: channels.A.trim, eq: channels.A.eq, volume: channels.A.volume },
      B: { trim: channels.B.trim, eq: channels.B.eq, volume: channels.B.volume }
    },
    mixer,
    deckPitch: {
      A: decks.A.pitch,
      B: decks.B.pitch
    }
  }

  localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(payload))
}

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
  syncDeck: (deckId: DeckId) => void
  triggerHotCue: (deckId: DeckId, index: number) => void
  clearHotCue: (deckId: DeckId, index: number) => void
  setLoopIn: (deckId: DeckId) => void
  setLoopOut: (deckId: DeckId) => void
  exitLoop: (deckId: DeckId) => void
  setAutoLoop: (deckId: DeckId, beats: number) => void
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
  const persistedControlsRef = useRef<PersistedControls | null>(null)

  if (!persistedControlsRef.current) {
    persistedControlsRef.current = readPersistedControls()
  }

  const [decks, setDecks] = useState<Record<DeckId, DeckState>>(() => ({
    A: { ...createDeckState(), pitch: persistedControlsRef.current?.deckPitch.A ?? 0 },
    B: { ...createDeckState(), pitch: persistedControlsRef.current?.deckPitch.B ?? 0 }
  }))
  const [channels, setChannels] = useState<Record<DeckId, ChannelState>>(() => ({
    A: { ...createChannelState(), ...persistedControlsRef.current?.channels.A },
    B: { ...createChannelState(), ...persistedControlsRef.current?.channels.B }
  }))
  const [mixer, setMixer] = useState<MixerState>(() => {
    return persistedControlsRef.current?.mixer ?? createMixerState()
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
    const persistedControls = persistedControlsRef.current

    if (persistedControls) {
      ;(['A', 'B'] as const).forEach((deckId) => {
        const deck = deckId === 'A' ? engine.deckA : engine.deckB
        const channel = persistedControls.channels[deckId]

        deck.setPitch(persistedControls.deckPitch[deckId])
        deck.setTrim(channel.trim)
        deck.setEq('high', channel.eq.high)
        deck.setEq('mid', channel.eq.mid)
        deck.setEq('low', channel.eq.low)
        deck.setChannelFader(channel.volume)
      })
      engine.mixer.setCrossfade(persistedControls.mixer.crossfade)
      engine.mixer.setCueMix(persistedControls.mixer.cueMix)
      engine.mixer.setMasterGain(persistedControls.mixer.masterVolume)
    }

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
    persistControls(channels, mixer, decks)
  }, [channels, decks.A.pitch, decks.B.pitch, mixer])

  useEffect(() => {
    let frameId = 0

    const tick = (): void => {
      engine.deckA.tickLoop()
      engine.deckB.tickLoop()
      setDecks((current) => ({
        A: {
          ...current.A,
          position: engine.deckA.getPosition(),
          isPlaying: engine.deckA.isPlaying,
          effectiveBpm: engine.deckA.getEffectiveBpm(),
          hotCues: engine.deckA.hotCues,
          loop: engine.deckA.loop
        },
        B: {
          ...current.B,
          position: engine.deckB.getPosition(),
          isPlaying: engine.deckB.isPlaying,
          effectiveBpm: engine.deckB.getEffectiveBpm(),
          hotCues: engine.deckB.hotCues,
          loop: engine.deckB.loop
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
          isPlaying: false,
          bpm: deck.metadata.bpm,
          firstBeatOffset: deck.metadata.firstBeatOffset,
          effectiveBpm: deck.getEffectiveBpm(),
          hotCues: deck.hotCues,
          loop: deck.loop,
          waveform: deck.waveform
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
      const deck = getDeck(deckId)
      const pitch = deck.setPitch(percent)
      setDecks((current) => ({
        ...current,
        [deckId]: { ...current[deckId], pitch, effectiveBpm: deck.getEffectiveBpm() }
      }))
    },
    [getDeck]
  )

  const syncDeck = useCallback(
    (deckId: DeckId): void => {
      const deck = getDeck(deckId)
      const otherDeck = getDeck(deckId === 'A' ? 'B' : 'A')
      const targetBpm = otherDeck.getEffectiveBpm()

      if (deck.metadata.bpm <= 0 || targetBpm <= 0) {
        return
      }

      const pitch = clamp((targetBpm / deck.metadata.bpm - 1) * 100, MIN_PITCH_PERCENT, MAX_PITCH_PERCENT)
      deck.setPitch(pitch)
      setDecks((current) => ({
        ...current,
        [deckId]: { ...current[deckId], pitch, effectiveBpm: deck.getEffectiveBpm() }
      }))
    },
    [getDeck]
  )

  const triggerHotCue = useCallback(
    (deckId: DeckId, index: number): void => {
      const deck = getDeck(deckId)
      deck.triggerHotCue(index)
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
      }))
    },
    [getDeck]
  )

  const clearHotCue = useCallback(
    (deckId: DeckId, index: number): void => {
      const deck = getDeck(deckId)
      deck.clearHotCue(index)
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
      }))
    },
    [getDeck]
  )

  const setLoopIn = useCallback(
    (deckId: DeckId): void => {
      const deck = getDeck(deckId)
      deck.setLoopIn()
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
      }))
    },
    [getDeck]
  )

  const setLoopOut = useCallback(
    (deckId: DeckId): void => {
      const deck = getDeck(deckId)
      deck.setLoopOut()
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
      }))
    },
    [getDeck]
  )

  const exitLoop = useCallback(
    (deckId: DeckId): void => {
      const deck = getDeck(deckId)
      deck.exitLoop()
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
      }))
    },
    [getDeck]
  )

  const setAutoLoop = useCallback(
    (deckId: DeckId, beats: number): void => {
      const deck = getDeck(deckId)
      deck.setAutoLoop(beats)
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
      }))
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
    syncDeck,
    triggerHotCue,
    clearHotCue,
    setLoopIn,
    setLoopOut,
    exitLoop,
    setAutoLoop,
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
