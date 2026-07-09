export function getJogAngleDelta(previous: number, next: number): number {
  let delta = next - previous

  if (delta > 180) {
    delta -= 360
  } else if (delta < -180) {
    delta += 360
  }

  return delta
}

export function getJogSeekPosition(startPosition: number, deltaDegrees: number, duration: number): number {
  return Math.min(duration, Math.max(0, startPosition + (deltaDegrees / 360) * 4))
}

export function getJogProgressDegrees(position: number, duration: number): number {
  return (duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0) * 360
}
