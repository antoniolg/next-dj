import { useCallback, useEffect, useRef, useState } from 'react'
import type { EqBand } from '../audio/deck'
import { getEngine, type DJEngine } from '../audio/engine'
import { createDeckState, getDeckSnapshot, type DeckState } from './deckState'
import { calculatePhaseNudgeSeconds, calculateSyncPitch, getPhaseOffsetSeconds } from './engineMath'
import {
  createChannelState,
  createMixerState,
  persistControls,
  readPersistedControls,
  type PersistedControls
} from './enginePersistence'
import type { ChannelState, DeckId, MixerState, OutputState } from './engineTypes'
import { useEngineOutput } from './useEngineOutput'
import { useTransportTicker } from './useTransportTicker'

export type { DeckId } from './engineTypes'

const NUDGE_SECONDS = 0.035
const JOG_SECONDS_PER_DEGREE = 0.001

export function useEngine(): {
  engine: DJEngine
  decks: Record<DeckId, DeckState>
  masterDeckId: DeckId | null
  phaseOffsets: Record<DeckId, number>
  channels: Record<DeckId, ChannelState>
  mixer: MixerState
  output: OutputState
  loadTrack: (deckId: DeckId, file: File) => Promise<void>
  togglePlayback: (deckId: DeckId) => Promise<void>
  seek: (deckId: DeckId, seconds: number) => void
  cueToStart: (deckId: DeckId) => void
  cuePress: (deckId: DeckId) => Promise<void>
  cueRelease: (deckId: DeckId) => void
  setPitch: (deckId: DeckId, percent: number) => void
  syncDeck: (deckId: DeckId) => void
  nudgeDeck: (deckId: DeckId, direction: -1 | 1) => void
  jogBend: (deckId: DeckId, degrees: number) => void
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
  const masterDeckIdRef = useRef<DeckId | null>(null)

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
  const [masterDeckId, setMasterDeckId] = useState<DeckId | null>(null)
  const deckPitchRef = useRef<Record<DeckId, number>>({
    A: persistedControlsRef.current?.deckPitch.A ?? 0,
    B: persistedControlsRef.current?.deckPitch.B ?? 0
  })

  const updateMasterDeck = useCallback((nextMasterDeckId: DeckId | null): void => {
    if (masterDeckIdRef.current === nextMasterDeckId) {
      return
    }

    masterDeckIdRef.current = nextMasterDeckId
    setMasterDeckId(nextMasterDeckId)
  }, [])

  if (!engineRef.current) {
    engineRef.current = getEngine()
  }

  const engine = engineRef.current
  const { output, setMasterDevice, setCueDevice, refreshOutputDevices } = useEngineOutput(engine)

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
    persistControls(channels, mixer, { A: decks.A.pitch, B: decks.B.pitch })
  }, [channels, decks.A.pitch, decks.B.pitch, mixer])

  useTransportTicker(engine, masterDeckIdRef, updateMasterDeck, setDecks)

  const loadTrack = useCallback(
    async (deckId: DeckId, file: File): Promise<void> => {
      const deck = getDeck(deckId)
      await deck.loadFile(file)
      const pitch = deck.setPitch(deckPitchRef.current[deckId])

      deckPitchRef.current[deckId] = pitch
      setDecks((current) => ({
        ...current,
        [deckId]: {
          ...current[deckId],
          trackName: deck.metadata.name,
          duration: deck.duration,
          position: 0,
          isPlaying: false,
          pitch,
          bpm: deck.metadata.bpm,
          firstBeatOffset: deck.metadata.firstBeatOffset,
          effectiveBpm: deck.getEffectiveBpm(),
          hotCues: deck.hotCues,
          cuePoint: deck.cuePoint,
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

  const cuePress = useCallback(
    async (deckId: DeckId): Promise<void> => {
      const deck = getDeck(deckId)
      await deck.cuePress()
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
      }))
    },
    [getDeck]
  )

  const cueRelease = useCallback(
    (deckId: DeckId): void => {
      const deck = getDeck(deckId)
      deck.cueRelease()
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
      }))
    },
    [getDeck]
  )

  const setPitch = useCallback(
    (deckId: DeckId, percent: number): void => {
      const deck = getDeck(deckId)
      const pitch = deck.setPitch(percent)

      deckPitchRef.current[deckId] = pitch
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

      const pitch = calculateSyncPitch(deck.metadata.bpm, targetBpm)

      if (pitch === null) {
        return
      }

      deck.setPitch(pitch)
      deckPitchRef.current[deckId] = pitch

      const nudgeSeconds = calculatePhaseNudgeSeconds(
        deck.getPosition(),
        deck.metadata.firstBeatOffset,
        deck.metadata.bpm,
        otherDeck.getPosition(),
        otherDeck.metadata.firstBeatOffset,
        otherDeck.metadata.bpm
      )

      if (Number.isFinite(nudgeSeconds) && Math.abs(nudgeSeconds) > 0.003) {
        deck.nudge(-nudgeSeconds)
      }

      // Starting after the phase alignment keeps the first audible sample on
      // beat: the seek was instant on a stopped deck and the scheduled start
      // is accounted as "now".
      if (!deck.isPlaying && otherDeck.isPlaying) {
        void deck.play()
      }

      setDecks((current) => ({
        ...current,
        [deckId]: { ...getDeckSnapshot(deck, pitch), pitch }
      }))
    },
    [getDeck]
  )

  const nudgeDeck = useCallback(
    (deckId: DeckId, direction: -1 | 1): void => {
      const deck = getDeck(deckId)
      deck.nudge(direction * NUDGE_SECONDS)
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
      }))
    },
    [getDeck]
  )

  const jogBend = useCallback(
    (deckId: DeckId, degrees: number): void => {
      const deck = getDeck(deckId)
      deck.jogShift(degrees * JOG_SECONDS_PER_DEGREE)
      setDecks((current) => ({
        ...current,
        [deckId]: getDeckSnapshot(deck, current[deckId].pitch)
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

  const phaseOffsets: Record<DeckId, number> = {
    A: masterDeckId && masterDeckId !== 'A' ? getPhaseOffsetSeconds(decks.A, decks[masterDeckId]) : 0,
    B: masterDeckId && masterDeckId !== 'B' ? getPhaseOffsetSeconds(decks.B, decks[masterDeckId]) : 0
  }

  return {
    engine,
    decks,
    masterDeckId,
    phaseOffsets,
    channels,
    mixer,
    output,
    loadTrack,
    togglePlayback,
    seek,
    cueToStart,
    cuePress,
    cueRelease,
    setPitch,
    syncDeck,
    nudgeDeck,
    jogBend,
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
