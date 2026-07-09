import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { isEditableTarget } from '../keyboard'
import type { DeckId } from './useEngine'

const CROSSFADER_NUDGE = 0.08
const PITCH_NUDGE = 0.1

interface UseAppShortcutsOptions {
  deckPitch: Record<DeckId, number>
  loadingDecks: Partial<Record<DeckId, string>>
  crossfade: number
  shortcutsOpen: boolean
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>
  togglePlayback: (deckId: DeckId) => Promise<void>
  cuePress: (deckId: DeckId) => Promise<void>
  cueRelease: (deckId: DeckId) => void
  syncDeck: (deckId: DeckId) => void
  toggleCue: (deckId: DeckId) => void
  setCrossfade: (value: number) => void
  setPitch: (deckId: DeckId, percent: number) => void
  nudgeDeck: (deckId: DeckId, direction: -1 | 1) => void
}

function isRepeatSensitiveCode(code: string): boolean {
  return (
    code === 'KeyQ' ||
    code === 'KeyW' ||
    code === 'KeyA' ||
    code === 'KeyS' ||
    code === 'KeyD' ||
    code === 'KeyF' ||
    code === 'KeyT' ||
    code === 'KeyY' ||
    code === 'KeyC'
  )
}

export function useAppShortcuts({
  deckPitch,
  loadingDecks,
  crossfade,
  shortcutsOpen,
  setShortcutsOpen,
  togglePlayback,
  cuePress,
  cueRelease,
  syncDeck,
  toggleCue,
  setCrossfade,
  setPitch,
  nudgeDeck
}: UseAppShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return
      }

      const deckALoading = Boolean(loadingDecks.A)
      const deckBLoading = Boolean(loadingDecks.B)

      if (event.repeat && isRepeatSensitiveCode(event.code)) {
        return
      }

      if (event.key === '?' || (event.code === 'Slash' && event.shiftKey)) {
        event.preventDefault()
        setShortcutsOpen((current) => !current)
        return
      }

      if (event.code === 'Escape' && shortcutsOpen) {
        event.preventDefault()
        setShortcutsOpen(false)
        return
      }

      if (event.code === 'KeyQ' && !deckALoading) {
        event.preventDefault()
        void togglePlayback('A')
        return
      }

      if (event.code === 'KeyW' && !deckBLoading) {
        event.preventDefault()
        void togglePlayback('B')
        return
      }

      if (event.code === 'KeyA' && !deckALoading) {
        event.preventDefault()
        void cuePress('A')
        return
      }

      if (event.code === 'KeyS' && !deckBLoading) {
        event.preventDefault()
        void cuePress('B')
        return
      }

      if (event.code === 'KeyD' && !deckALoading) {
        event.preventDefault()
        syncDeck('A')
        return
      }

      if (event.code === 'KeyF' && !deckBLoading) {
        event.preventDefault()
        syncDeck('B')
        return
      }

      if (event.code === 'KeyT') {
        event.preventDefault()
        toggleCue('A')
        return
      }

      if (event.code === 'KeyY') {
        event.preventDefault()
        toggleCue('B')
        return
      }

      if (event.code === 'KeyZ') {
        event.preventDefault()
        setCrossfade(Math.max(-1, crossfade - CROSSFADER_NUDGE))
        return
      }

      if (event.code === 'KeyX') {
        event.preventDefault()
        setCrossfade(Math.min(1, crossfade + CROSSFADER_NUDGE))
        return
      }

      if (event.code === 'KeyC') {
        event.preventDefault()
        setCrossfade(0)
        return
      }

      if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        const direction = event.code === 'ArrowUp' ? 1 : -1

        if (event.shiftKey) {
          event.preventDefault()
          setPitch('A', deckPitch.A + direction * PITCH_NUDGE)
          return
        }

        if (event.altKey) {
          event.preventDefault()
          setPitch('B', deckPitch.B + direction * PITCH_NUDGE)
          return
        }
      }

      if (event.code === 'BracketLeft') {
        event.preventDefault()
        nudgeDeck(event.shiftKey ? 'B' : 'A', -1)
        return
      }

      if (event.code === 'BracketRight') {
        event.preventDefault()
        nudgeDeck(event.shiftKey ? 'B' : 'A', 1)
      }
    }

    const handleKeyUp = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return
      }

      if (event.code === 'KeyA') {
        cueRelease('A')
        return
      }

      if (event.code === 'KeyS') {
        cueRelease('B')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    crossfade,
    cuePress,
    cueRelease,
    deckPitch.A,
    deckPitch.B,
    loadingDecks.A,
    loadingDecks.B,
    nudgeDeck,
    setCrossfade,
    setPitch,
    setShortcutsOpen,
    shortcutsOpen,
    syncDeck,
    toggleCue,
    togglePlayback
  ])
}
