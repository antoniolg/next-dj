import { type Dispatch, type SetStateAction, useCallback } from 'react'
import type { EqBand } from '../audio/deck'
import type { DJEngine } from '../audio/engine'
import type { Deck } from '../audio/deck'
import type { ChannelState, DeckId, MixerState } from './engineTypes'

type GetDeck = (deckId: DeckId) => Deck

export interface MixerActions {
  setTrim: (deckId: DeckId, value: number) => void
  setEq: (deckId: DeckId, band: EqBand, value: number) => void
  setChannelVolume: (deckId: DeckId, value: number) => void
  toggleCue: (deckId: DeckId) => void
  setCrossfade: (value: number) => void
  setCueMix: (value: number) => void
  setMasterVolume: (value: number) => void
}

export function useMixerActions(
  engine: DJEngine,
  getDeck: GetDeck,
  setChannels: Dispatch<SetStateAction<Record<DeckId, ChannelState>>>,
  setMixer: Dispatch<SetStateAction<MixerState>>
): MixerActions {
  const setTrim = useCallback(
    (deckId: DeckId, value: number): void => {
      getDeck(deckId).setTrim(value)
      setChannels((current) => ({ ...current, [deckId]: { ...current[deckId], trim: value } }))
    },
    [getDeck, setChannels]
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
    [getDeck, setChannels]
  )

  const setChannelVolume = useCallback(
    (deckId: DeckId, value: number): void => {
      getDeck(deckId).setChannelFader(value)
      setChannels((current) => ({ ...current, [deckId]: { ...current[deckId], volume: value } }))
    },
    [getDeck, setChannels]
  )

  const toggleCue = useCallback(
    (deckId: DeckId): void => {
      setChannels((current) => {
        const nextCue = !current[deckId].cue
        engine.mixer.setCue(deckId, nextCue)
        return { ...current, [deckId]: { ...current[deckId], cue: nextCue } }
      })
    },
    [engine, setChannels]
  )

  const setCrossfade = useCallback(
    (value: number): void => {
      engine.mixer.setCrossfade(value)
      setMixer((current) => ({ ...current, crossfade: value }))
    },
    [engine, setMixer]
  )

  const setCueMix = useCallback(
    (value: number): void => {
      engine.mixer.setCueMix(value)
      setMixer((current) => ({ ...current, cueMix: value }))
    },
    [engine, setMixer]
  )

  const setMasterVolume = useCallback(
    (value: number): void => {
      engine.mixer.setMasterGain(value)
      setMixer((current) => ({ ...current, masterVolume: value }))
    },
    [engine, setMixer]
  )

  return {
    setTrim,
    setEq,
    setChannelVolume,
    toggleCue,
    setCrossfade,
    setCueMix,
    setMasterVolume
  }
}
