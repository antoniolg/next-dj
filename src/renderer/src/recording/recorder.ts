import { RECORDING_FRAME_RATE, VideoCompositor } from './compositor'
import { pickAudioMime, pickVideoMime } from './mimeTypes'

export type RecordingMode = 'audio' | 'audio-screen' | 'audio-screen-camera'
export type RecorderPhase = 'idle' | 'countdown' | 'starting' | 'recording' | 'stopping' | 'saved' | 'error'

export interface RecorderSnapshot {
  phase: RecorderPhase
  mode: RecordingMode | null
  startedAtMs: number | null
  countdownRemaining: number | null
  filePath: string | null
  warning: string | null
  error: string | null
}

const COUNTDOWN_SECONDS = 5
const TIMESLICE_MS = 1000
const VIDEO_BITS_PER_SECOND = 5_000_000
const AUDIO_BITS_PER_SECOND = 192_000

function getBridge(): NonNullable<Window['nextdj']> {
  const bridge = window.nextdj

  if (!bridge) {
    throw new Error('Recording is only available in the desktop app.')
  }

  return bridge
}

export class Recorder {
  onChange: ((snapshot: RecorderSnapshot) => void) | null = null

  private readonly getRecordStream: () => MediaStream
  private snapshot: RecorderSnapshot = {
    phase: 'idle',
    mode: null,
    startedAtMs: null,
    countdownRemaining: null,
    filePath: null,
    warning: null,
    error: null
  }

  private countdownTimeoutId: number | null = null
  private countdownResolve: ((completed: boolean) => void) | null = null
  private sessionId: string | null = null
  private mediaRecorder: MediaRecorder | null = null
  private compositor: VideoCompositor | null = null
  private screenTrack: MediaStreamTrack | null = null
  private cameraTrack: MediaStreamTrack | null = null
  private pendingWrites: Promise<void> = Promise.resolve()
  private unsubscribeWriteError: (() => void) | null = null

  constructor(getRecordStream: () => MediaStream) {
    this.getRecordStream = getRecordStream
  }

  getSnapshot(): RecorderSnapshot {
    return this.snapshot
  }

  async start(mode: RecordingMode): Promise<void> {
    if (!['idle', 'saved', 'error'].includes(this.snapshot.phase)) {
      return
    }

    try {
      const countdownCompleted = await this.runCountdown(mode)

      if (!countdownCompleted) {
        return
      }

      this.update({
        phase: 'starting',
        mode,
        startedAtMs: null,
        countdownRemaining: null,
        filePath: null,
        warning: null,
        error: null
      })

      await this.startInternal(mode)
    } catch (error) {
      await this.releaseMediaResources()

      if (this.sessionId) {
        const sessionId = this.sessionId
        this.sessionId = null
        void getBridge().cancelRecording(sessionId, true)
      }

      this.update({
        ...this.snapshot,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Could not start the recording.'
      })
    }
  }

  async stop(): Promise<void> {
    if (this.snapshot.phase === 'countdown') {
      this.cancelCountdown(true)
      return
    }

    if (this.snapshot.phase !== 'recording' || !this.mediaRecorder || !this.sessionId) {
      return
    }

    this.update({ ...this.snapshot, phase: 'stopping' })
    await this.finalize(null)
  }

  dismiss(): void {
    if (this.snapshot.phase === 'saved' || this.snapshot.phase === 'error') {
      this.update({
        phase: 'idle',
        mode: null,
        startedAtMs: null,
        countdownRemaining: null,
        filePath: null,
        warning: null,
        error: null
      })
    }
  }

  dispose(): void {
    this.cancelCountdown(false)
    this.unsubscribeWriteError?.()
    this.unsubscribeWriteError = null
    void this.releaseMediaResources()
  }

  private runCountdown(mode: RecordingMode): Promise<boolean> {
    this.cancelCountdown(false)

    return new Promise((resolve) => {
      let remaining = COUNTDOWN_SECONDS
      this.countdownResolve = resolve

      const tick = (): void => {
        if (remaining <= 0) {
          this.resolveCountdown(true)
          return
        }

        this.update({
          phase: 'countdown',
          mode,
          startedAtMs: null,
          countdownRemaining: remaining,
          filePath: null,
          warning: null,
          error: null
        })

        remaining -= 1
        this.countdownTimeoutId = window.setTimeout(tick, 1000)
      }

      tick()
    })
  }

  private cancelCountdown(updateState: boolean): void {
    const wasCountingDown = this.snapshot.phase === 'countdown'

    this.resolveCountdown(false)

    if (updateState && wasCountingDown) {
      this.update({
        phase: 'idle',
        mode: null,
        startedAtMs: null,
        countdownRemaining: null,
        filePath: null,
        warning: null,
        error: null
      })
    }
  }

  private resolveCountdown(completed: boolean): void {
    if (this.countdownTimeoutId !== null) {
      window.clearTimeout(this.countdownTimeoutId)
      this.countdownTimeoutId = null
    }

    const resolve = this.countdownResolve
    this.countdownResolve = null
    resolve?.(completed)
  }

  private async startInternal(mode: RecordingMode): Promise<void> {
    const bridge = getBridge()
    const wantsVideo = mode !== 'audio'
    const mime = wantsVideo ? pickVideoMime() : pickAudioMime()

    if (!mime) {
      throw new Error('This system has no supported recording format.')
    }

    let warning: string | null = null
    let videoTrack: MediaStreamTrack | null = null

    if (wantsVideo) {
      if (mode === 'audio-screen-camera') {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 24, max: 24 } },
            audio: false
          })
          this.cameraTrack = cameraStream.getVideoTracks()[0] ?? null

          if (!this.cameraTrack) {
            warning = 'Camera gave no video — recording without PiP.'
          } else {
            this.cameraTrack.contentHint = 'motion'

            this.cameraTrack.addEventListener('ended', () => {
              if (this.snapshot.phase === 'recording') {
                this.update({
                  ...this.snapshot,
                  warning: 'Camera stopped — recording continues without PiP.'
                })
              }
            })
          }
        } catch (error) {
          console.warn('[recording] camera unavailable:', error)
          const denied = error instanceof DOMException && error.name === 'NotAllowedError'
          warning = denied
            ? 'Camera permission denied (check System Settings → Privacy → Camera) — recording without PiP.'
            : 'Camera unavailable — recording without PiP.'
        }
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: RECORDING_FRAME_RATE, max: RECORDING_FRAME_RATE }
        },
        audio: false
      })
      this.screenTrack = screenStream.getVideoTracks()[0] ?? null

      if (!this.screenTrack) {
        throw new Error('Screen capture did not provide a video track.')
      }

      this.screenTrack.contentHint = 'detail'

      // Losing the screen source shouldn't lose the set: finalize what we
      // have instead of discarding it.
      this.screenTrack.addEventListener('ended', () => {
        if (this.snapshot.phase === 'recording') {
          void this.finalize('Screen capture ended — recording saved up to that point.')
        }
      })

      this.compositor = new VideoCompositor(this.screenTrack, this.cameraTrack)
      videoTrack = await this.compositor.start()
    }

    const audioTrack = this.getRecordStream().getAudioTracks()[0]

    if (!audioTrack) {
      throw new Error('The record bus has no audio track.')
    }

    const tracks = videoTrack ? [videoTrack, audioTrack] : [audioTrack]
    const stream = new MediaStream(tracks)

    const { id, filePath } = await bridge.startRecording({
      extension: mime.extension,
      video: wantsVideo
    })
    this.sessionId = id

    this.unsubscribeWriteError?.()
    this.unsubscribeWriteError = bridge.onRecordingWriteError((writeError) => {
      if (writeError.id === this.sessionId && this.snapshot.phase === 'recording') {
        void this.abortAfterWriteError(writeError.message)
      }
    })

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mime.mimeType,
      videoBitsPerSecond: wantsVideo ? VIDEO_BITS_PER_SECOND : undefined,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND
    })

    mediaRecorder.ondataavailable = (event): void => {
      if (event.data.size === 0 || !this.sessionId) {
        return
      }

      const sessionId = this.sessionId
      // Chunks must land on disk in order; invoke resolution order across
      // separate calls is not guaranteed, so writes are chained.
      this.pendingWrites = this.pendingWrites
        .then(() => event.data.arrayBuffer())
        .then((buffer) => bridge.appendRecordingChunk(sessionId, buffer))
        .catch(() => undefined)
    }

    mediaRecorder.onerror = (): void => {
      if (this.snapshot.phase === 'recording') {
        void this.finalize('Recorder error — recording saved up to that point.')
      }
    }

    mediaRecorder.onstart = (): void => {
      this.update({
        ...this.snapshot,
        phase: 'recording',
        startedAtMs: Date.now(),
        countdownRemaining: null,
        filePath,
        warning
      })
    }

    this.mediaRecorder = mediaRecorder
    mediaRecorder.start(TIMESLICE_MS)
  }

  private async finalize(warning: string | null): Promise<void> {
    const bridge = getBridge()
    const mediaRecorder = this.mediaRecorder
    const sessionId = this.sessionId

    if (!mediaRecorder || !sessionId) {
      return
    }

    this.mediaRecorder = null

    if (mediaRecorder.state !== 'inactive') {
      const stopped = new Promise<void>((resolve) => {
        mediaRecorder.addEventListener('stop', () => resolve(), { once: true })
      })
      mediaRecorder.stop()
      await stopped
    }

    // Some MediaRecorder implementations emit their final dataavailable event
    // at the end of the stop turn. Let that handler append to pendingWrites
    // before we decide all bytes are on disk.
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    await this.pendingWrites
    this.sessionId = null
    await this.releaseMediaResources()

    try {
      const { filePath } = await bridge.stopRecording(sessionId)
      this.update({
        ...this.snapshot,
        phase: 'saved',
        filePath,
        warning: warning ?? this.snapshot.warning
      })
    } catch (error) {
      this.update({
        ...this.snapshot,
        phase: 'error',
        error: error instanceof Error ? error.message : 'Could not save the recording.'
      })
    }
  }

  private async abortAfterWriteError(message: string): Promise<void> {
    // Main already closed the file; just tear down the capture side.
    const mediaRecorder = this.mediaRecorder
    this.mediaRecorder = null
    this.sessionId = null

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }

    await this.releaseMediaResources()
    this.update({ ...this.snapshot, phase: 'error', error: message })
  }

  private async releaseMediaResources(): Promise<void> {
    this.compositor?.stop()
    this.compositor = null
    // The record-bus audio track is permanent and must never be stopped.
    this.screenTrack?.stop()
    this.screenTrack = null
    this.cameraTrack?.stop()
    this.cameraTrack = null
  }

  private update(snapshot: RecorderSnapshot): void {
    this.snapshot = snapshot
    this.onChange?.(snapshot)
  }
}
