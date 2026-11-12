import { Injectable, signal } from '@angular/core';

export type MicrophoneState = 'idle' | 'requesting' | 'calibrating' | 'ready' | 'denied' | 'unsupported';

@Injectable({ providedIn: 'root' })
export class VoiceInputService {
  readonly state = signal<MicrophoneState>('idle');
  readonly calibrationProgress = signal(0);
  readonly noiseFloor = signal(0.02);
  readonly message = signal('');

  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private stream?: MediaStream;
  private samples: number[] = [];
  private smoothing = 0;
  private lastSampleAt = 0;
  private timeDataBuffer = new Uint8Array(512);
  private calibrationFallbackTimer?: number;

  async beginCalibration(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.state.set('unsupported');
      this.message.set('This browser cannot access a microphone.');
      return;
    }

    this.state.set('requesting');
    this.message.set('Requesting microphone access…');
    try {
      this.stop();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });

      this.context = new AudioContext();
      if (this.context.state === 'suspended') {
        await this.context.resume().catch(() => {});
      }

      const source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.7;
      source.connect(this.analyser);
      this.timeDataBuffer = new Uint8Array(this.analyser.fftSize);

      this.samples = [];
      this.smoothing = 0;
      this.calibrationProgress.set(0);
      this.state.set('calibrating');
      this.message.set('Stay quiet for a moment…');

      const started = performance.now();
      const calibrationDurationMs = 1200; // 1.2s quick calibration

      if (this.calibrationFallbackTimer) clearTimeout(this.calibrationFallbackTimer);
      this.calibrationFallbackTimer = window.setTimeout(() => {
        if (this.state() === 'calibrating') {
          this.finishCalibration();
        }
      }, calibrationDurationMs + 200);

      const collect = (now: number) => {
        if (this.state() !== 'calibrating') return;
        const raw = this.readRawVolume();
        this.samples.push(raw);
        this.smoothing = this.smoothing * 0.8 + raw * 0.2;

        const progress = Math.min(1, (now - started) / calibrationDurationMs);
        this.calibrationProgress.set(progress);

        if (progress >= 0.95) {
          this.finishCalibration();
        } else {
          requestAnimationFrame(collect);
        }
      };

      requestAnimationFrame(collect);
    } catch {
      this.state.set('denied');
      this.message.set('Microphone access was not granted. You can still play using Space or Screen Tap!');
    }
  }

  /** Instant skip to ready without waiting */
  skipCalibration(): void {
    if (this.calibrationFallbackTimer) clearTimeout(this.calibrationFallbackTimer);
    this.noiseFloor.set(0.02);
    this.calibrationProgress.set(1);
    this.state.set('ready');
    this.message.set('Ready! Shout or speak to jump.');
  }

  /**
   * Pure polling tick — returns normalized volume [0, 1].
   * Does NOT write to any Angular Signals to prevent NG0600 errors.
   */
  tick(): number {
    if (this.state() !== 'ready') return 0;
    const now = performance.now();
    if (now - this.lastSampleAt > 14) {
      this.lastSampleAt = now;
      const raw = this.readRawVolume();
      this.smoothing = this.smoothing * 0.8 + raw * 0.2;
    }
    const voiceReference = this.noiseFloor() + 0.16;
    return Math.max(0, Math.min(1, (this.smoothing - this.noiseFloor()) / (voiceReference - this.noiseFloor())));
  }

  stop(): void {
    if (this.calibrationFallbackTimer) {
      clearTimeout(this.calibrationFallbackTimer);
      this.calibrationFallbackTimer = undefined;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.analyser = undefined;
    this.context?.close().catch(() => undefined);
    this.context = undefined;
  }

  private finishCalibration(): void {
    if (this.calibrationFallbackTimer) {
      clearTimeout(this.calibrationFallbackTimer);
      this.calibrationFallbackTimer = undefined;
    }
    const average = this.samples.length > 0
      ? this.samples.reduce((total, value) => total + value, 0) / this.samples.length
      : 0.02;

    this.noiseFloor.set(Math.min(0.12, Math.max(0.008, average + 0.008)));
    this.calibrationProgress.set(1);
    this.state.set('ready');
    this.message.set('Ready. Speak louder to jump higher.');
  }

  private readRawVolume(): number {
    if (!this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.timeDataBuffer);
    let sum = 0;
    const len = this.timeDataBuffer.length;
    for (let i = 0; i < len; i++) {
      const val = (this.timeDataBuffer[i] - 128) / 128;
      sum += val * val;
    }
    return Math.sqrt(sum / len);
  }
}
