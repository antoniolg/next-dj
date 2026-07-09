import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { DJEngine } from '../audio/engine'
import type { DeckState } from './deckState'
import type { DeckId } from './engineTypes'

export function useTransportTicker(
  engine: DJEngine,
  masterDeckIdRef: MutableRefObject<DeckId | null>,
  updateMasterDeck: (deckId: DeckId | null) => void,
  setDecks: Dispatch<SetStateAction<Record<DeckId, DeckState>>>
): void {
  useEffect(() => {
    let frameId = 0

    const tick = (): void => {
      engine.deckA.tickLoop()
      engine.deckB.tickLoop()
      const deckAPlaying = engine.deckA.isPlaying
      const deckBPlaying = engine.deckB.isPlaying
      const currentMaster = masterDeckIdRef.current

      if (currentMaster === 'A' && deckAPlaying) {
        updateMasterDeck('A')
      } else if (currentMaster === 'B' && deckBPlaying) {
        updateMasterDeck('B')
      } else if (deckAPlaying) {
        updateMasterDeck('A')
      } else if (deckBPlaying) {
        updateMasterDeck('B')
      } else {
        updateMasterDeck(null)
      }

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
  }, [engine, masterDeckIdRef, setDecks, updateMasterDeck])
}
