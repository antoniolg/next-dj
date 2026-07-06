import { Deck } from './deck'
import { Mixer } from './mixer'

export class DJEngine {
  readonly mixer: Mixer
  readonly deckA: Deck
  readonly deckB: Deck

  constructor() {
    this.mixer = new Mixer()
    this.deckA = new Deck(this.mixer.context)
    this.deckB = new Deck(this.mixer.context)

    this.deckA.output.connect(this.mixer.channelAInput)
    this.deckB.output.connect(this.mixer.channelBInput)
  }
}

let engine: DJEngine | null = null

export function getEngine(): DJEngine {
  engine ??= new DJEngine()
  return engine
}
